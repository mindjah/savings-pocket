import { db } from '../db/db'
import { roundFiat } from './format'

// Undoes a previous auto-debit tied to a spending entry (restores the pocket's
// balance and removes the linked history record). Safe to call on an entry
// that was never auto-debited — it's a no-op.
export async function reverseAutoDebit(spendingEntryId: number): Promise<void> {
  const history = await db.savingsHistory.where('spendingEntryId').equals(spendingEntryId).first()
  if (!history) return
  await db.savingsEntries.update(history.entryId, {
    amount: history.previousAmount,
    updatedAt: new Date().toISOString(),
  })
  await db.savingsHistory.delete(history.id!)
}

// Debits a saving pocket for a spending entry and logs it to that pocket's
// Spending history tab.
export async function applyAutoDebit(pocketId: number, amount: number, spendingEntryId: number, comment: string): Promise<void> {
  const pocket = await db.savingsEntries.get(pocketId)
  if (!pocket) return
  const now = new Date().toISOString()
  const newAmount = roundFiat(pocket.amount - amount, pocket.currency)
  await db.savingsEntries.update(pocketId, { amount: newAmount, updatedAt: now })
  await db.savingsHistory.add({
    entryId: pocketId,
    previousAmount: pocket.amount,
    newAmount,
    date: now,
    comment,
    source: 'spending',
    spendingEntryId,
  })
}
