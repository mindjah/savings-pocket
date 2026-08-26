import { db } from '../db/db'
import type { Language, RecurrenceType, SavingsTrackingMode } from '../db/types'
import { tDays, translate } from '../i18n/translations'
import { applyAutoDebit } from './autoDebit'
import { todayIso } from './format'

export function computeNextDate(dateIso: string, type: RecurrenceType, intervalDays?: number): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (type === 'monthly') date.setMonth(date.getMonth() + 1)
  else if (type === 'annually') date.setFullYear(date.getFullYear() + 1)
  else date.setDate(date.getDate() + (intervalDays && intervalDays > 0 ? intervalDays : 1))
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

// Catches up every active recurring expense to today, generating one spending
// entry per elapsed period (not just one) so a long-closed app still fills in
// every occurrence that was due while it was shut.
export async function materializeRecurringExpenses(): Promise<void> {
  const today = todayIso()
  const [modeRec, recurring, categories] = await Promise.all([
    db.meta.get('savingsTrackingMode'),
    db.recurringExpenses.toArray(),
    db.categories.toArray(),
  ])
  const mode = (modeRec?.value as SavingsTrackingMode) ?? 'manual'
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const due = recurring.filter((r) => r.active && r.nextDate <= today)
  if (due.length === 0) return

  await db.transaction(
    'rw',
    db.recurringExpenses,
    db.spendingEntries,
    db.savingsEntries,
    db.savingsHistory,
    async () => {
      for (const r of due) {
        let cursor = r.nextDate
        while (cursor <= today) {
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
          cursor = computeNextDate(cursor, r.recurrenceType, r.intervalDays)
        }
        await db.recurringExpenses.update(r.id!, { nextDate: cursor })
      }
    },
  )
}
