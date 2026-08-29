import { db } from '../db/db'
import type { Language, RecurrenceType, SavingsTrackingMode } from '../db/types'
import { tDays, translate } from '../i18n/translations'
import { applyAutoDebit } from './autoDebit'
import { todayIso } from './format'

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export function computeNextDate(dateIso: string, type: RecurrenceType, intervalDays?: number): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  if (type === 'monthly' || type === 'annually') {
    // Adding a month/year via Date.setMonth/setFullYear on a day-of-month
    // that doesn't exist in the target month (e.g. the 30th, added to
    // January, landing in a 28-day February) silently overflows into the
    // month after — Jan 30 -> Mar 2, and every later occurrence stays
    // drifted onto the 2nd forever. Clamp to that month's last day instead.
    const yy = type === 'monthly' ? y + Math.floor(m / 12) : y + 1
    const mm0 = type === 'monthly' ? m % 12 : m - 1
    const dd = Math.min(d, lastDayOfMonth(yy, mm0))
    return `${yy}-${String(mm0 + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + (intervalDays && intervalDays > 0 ? intervalDays : 1))
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function recurrenceLabel(type: RecurrenceType, intervalDays?: number, lang: Language = 'en'): string {
  if (type === 'monthly') return translate(lang, 'Monthly')
  if (type === 'annually') return translate(lang, 'Annually')
  const days = intervalDays && intervalDays > 0 ? intervalDays : 1
  return lang === 'ru' ? `Каждые ${tDays(lang, days)}` : `Every ${tDays(lang, days)}`
}

// How many occurrences ahead the calendar previews for an active recurring
// expense — so it keeps showing up several periods out, not just the very
// next one, as you page the calendar forward.
export const RECURRING_PREVIEW_COUNT = 12

export function recurringPreviewDates(
  r: { nextDate: string; recurrenceType: RecurrenceType; intervalDays?: number },
  count: number = RECURRING_PREVIEW_COUNT,
): string[] {
  const dates: string[] = []
  let cursor = r.nextDate
  for (let i = 0; i < count; i++) {
    dates.push(cursor)
    cursor = computeNextDate(cursor, r.recurrenceType, r.intervalDays)
  }
  return dates
}

// Catches up every active recurring expense to today, generating one spending
// entry per elapsed period (not just one) so a long-closed app still fills in
// every occurrence that was due while it was shut.
export async function materializeRecurringExpenses(): Promise<void> {
  const today = todayIso()
  const modeRec = await db.meta.get('savingsTrackingMode')
  const mode = (modeRec?.value as SavingsTrackingMode) ?? 'manual'
  const categories = await db.categories.toArray()
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  await db.transaction(
    'rw',
    db.recurringExpenses,
    db.spendingEntries,
    db.savingsEntries,
    db.savingsHistory,
    async () => {
      // Read fresh, inside the transaction — this function runs on every app
      // open, and React StrictMode's dev-only double effect invocation (or
      // any other double call) must not see the same "nothing created yet"
      // snapshot twice. IndexedDB serializes transactions that touch the
      // same tables, so a second concurrent call's reads here only start
      // once the first call's writes have actually committed.
      const recurring = await db.recurringExpenses.toArray()
      const allSpending = await db.spendingEntries.toArray()

      // Self-heal: an earlier version advanced nextDate past a first
      // occurrence that hadn't actually happened yet — that occurrence was
      // still created (as a future-dated entry) but nextDate skipped
      // straight past it. If a linked entry exists earlier than nextDate,
      // nextDate should point there.
      for (const r of recurring) {
        if (!r.active || r.nextDate <= today) continue
        const futureLinkedDates = allSpending
          .filter((e) => e.recurringExpenseId === r.id && e.date > today)
          .map((e) => e.date)
        if (futureLinkedDates.length === 0) continue
        const earliest = futureLinkedDates.reduce((min, d) => (d < min ? d : min))
        if (earliest < r.nextDate) {
          await db.recurringExpenses.update(r.id!, { nextDate: earliest })
          r.nextDate = earliest
        }
      }

      const due = recurring.filter((r) => r.active && r.nextDate <= today)
      for (const r of due) {
        // A recurring expense whose first occurrence was set up for a future
        // date already has that one entry (created when the form was
        // submitted) while nextDate still points at it — skip re-creating
        // it here, just advance the cursor past it.
        const existingDates = new Set(allSpending.filter((e) => e.recurringExpenseId === r.id).map((e) => e.date))
        let cursor = r.nextDate
        while (cursor <= today) {
          if (!existingDates.has(cursor)) {
            const categoryName = categoryMap.get(r.categoryId)?.name ?? 'expense'
            const comment = `Spent on ${categoryName}${r.note.trim() ? ` — ${r.note.trim()}` : ''} (recurring)`
            const newId = await db.spendingEntries.add({
              categoryId: r.categoryId,
              amount: r.amount,
              currency: r.currency,
              note: r.note,
              date: cursor,
              createdAt: new Date().toISOString(),
              recurringExpenseId: r.id,
            })
            if (mode === 'auto' && r.debitedFromPocketId != null) {
              await applyAutoDebit(r.debitedFromPocketId, r.amount, newId, comment)
              await db.spendingEntries.update(newId, { debitedFromPocketId: r.debitedFromPocketId })
            }
          }
          cursor = computeNextDate(cursor, r.recurrenceType, r.intervalDays)
        }
        await db.recurringExpenses.update(r.id!, { nextDate: cursor })
      }
    },
  )
}
