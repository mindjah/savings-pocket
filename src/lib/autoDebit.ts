import { db } from '../db/db'
import { roundFiat } from './format'

// Undoes a previous auto-debit tied to a spending entry (restores the pocket's
// balance). Safe to call on an entry that was never auto-debited — it's a
// no-op.
//
// Adds the originally-debited amount back onto the pocket's CURRENT balance
// (a relative undo) rather than overwriting it with history.previousAmount —
// that field is a snapshot from whenever the debit originally happened, and
// jumping straight back to it would silently discard any deposits, other
// spending, or transfers made against this pocket since then.
//
// Called from two different situations, which handle the history record
// differently: editing a spending entry reverses the old debit and
// immediately re-applies a new one, so the old record is just removed (the
// new one replaces it). Actually deleting the entry (deleted: true) has
// nothing to replace it — the record is kept and flagged reversed instead,
// so the pocket's history still shows that a debit happened here and was
// later undone, rather than making the deletion invisible.
export async function reverseAutoDebit(spendingEntryId: number, options?: { deleted?: boolean }): Promise<void> {
  const history = await db.savingsHistory.where('spendingEntryId').equals(spendingEntryId).first()
  if (!history) return
  const pocket = await db.savingsEntries.get(history.entryId)
  if (!pocket) return
  const debitedAmount = history.previousAmount - history.newAmount
  await db.savingsEntries.update(history.entryId, {
    amount: roundFiat(pocket.amount + debitedAmount, pocket.currency),
    updatedAt: new Date().toISOString(),
  })
  if (options?.deleted) {
    await db.savingsHistory.update(history.id!, { reversed: true })
  } else {
    await db.savingsHistory.delete(history.id!)
  }
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
