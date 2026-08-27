import { db } from '../db/db'
import { applyAutoDebit } from './autoDebit'
import { todayIso } from './format'

// A manually-added expense dated in the future isn't charged to its pocket
// at creation time (see DayEntriesModal) — only once its date actually
// arrives. This catches up any that are now due, the same way
// materializeRecurringExpenses() catches up recurring ones on app open.
export async function materializePendingAutoDebits(): Promise<void> {
  const today = todayIso()
  const [dueEntries, categories] = await Promise.all([
    db.spendingEntries.where('date').belowOrEqual(today).toArray(),
    db.categories.toArray(),
  ])
  const pending = dueEntries.filter((e) => e.debitedFromPocketId != null)
  if (pending.length === 0) return
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
    for (const e of pending) {
      const already = await db.savingsHistory.where('spendingEntryId').equals(e.id!).first()
      if (already) continue
      const categoryName = categoryMap.get(e.categoryId)?.name ?? 'expense'
      const comment = `Spent on ${categoryName}${e.note.trim() ? ` — ${e.note.trim()}` : ''}`
      await applyAutoDebit(e.debitedFromPocketId!, e.amount, e.id!, comment)
    }
  })
}
