import { db } from '../db/db'
import type { SavingsHistory } from '../db/types'
import { roundFiat } from './format'

// The expense amount this history row currently debits from its pocket —
// the ORIGINAL amount if it's never been edited, or whatever the most
// recent edit changed it to. previousAmount/newAmount on the row itself are
// a frozen point-in-time snapshot of the pocket's real balance at CREATION
// only (see applyAutoDebit) and are never rewritten by an edit, precisely
// so they stay a true snapshot even once other unrelated activity (a
// deposit, another debit) touches the same pocket in between edits —
// recomputing them against a stale "as if nothing else ever happened"
// baseline is what used to make the pocket's real balance and the
// displayed history disagree.
export function currentDebitedAmount(history: SavingsHistory): number {
  const edits = history.edits ?? []
  return edits.length > 0 ? edits[edits.length - 1].newAmount : history.previousAmount - history.newAmount
}

// Undoes a previous auto-debit tied to a spending entry (restores the pocket's
// balance). Safe to call on an entry that was never auto-debited — it's a
// no-op.
//
// Adds the currently-debited amount back onto the pocket's CURRENT balance
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
  const debitedAmount = currentDebitedAmount(history)
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

// Applies an edited spending entry's auto-debit. When the debit still lands
// on the same pocket, this adjusts that pocket's balance by the delta
// between the old and new amounts and edits the SAME savingsHistory row in
// place — but rather than recomputing (and overwriting) a pocket-balance
// pair against the row's original creation-time snapshot, it appends a
// step to that row's edit trail recording the EXPENSE's own amount before
// and after this edit (never the pocket's balance, which the row's own
// previousAmount/newAmount already capture once, correctly, at creation —
// see currentDebitedAmount). So the pocket's history still shows one note
// for this expense while revealing exactly how its amount changed over
// time ("was €10, edited to €100, edited to €90"), and the pocket's real
// balance stays correct even when other activity (a deposit, another
// debit) happens on the same pocket in between edits. Falls back to
// reverse-then-(re)apply (which does create/remove a row, with no trail —
// it's a different pocket's history) when there's no existing row to
// adjust, the debit is moving to a different pocket, or it's being turned
// off.
export async function updateAutoDebit(
  spendingEntryId: number,
  newPocketId: number | null,
  newAmount: number,
  newComment: string,
): Promise<void> {
  const history = await db.savingsHistory.where('spendingEntryId').equals(spendingEntryId).first()

  if (!history || newPocketId == null || history.entryId !== newPocketId) {
    await reverseAutoDebit(spendingEntryId)
    if (newPocketId != null) {
      await applyAutoDebit(newPocketId, newAmount, spendingEntryId, newComment)
    }
    return
  }

  const pocket = await db.savingsEntries.get(history.entryId)
  if (!pocket) return
  const oldAmount = currentDebitedAmount(history)
  // Nothing actually changed (e.g. the form was saved without editing
  // amount or note) — skip logging a no-op edit step.
  if (newAmount === oldAmount && newComment === history.comment) return

  await db.savingsEntries.update(history.entryId, {
    amount: roundFiat(pocket.amount + oldAmount - newAmount, pocket.currency),
    updatedAt: new Date().toISOString(),
  })
  await db.savingsHistory.update(history.id!, {
    comment: newComment,
    edits: [...(history.edits ?? []), { date: new Date().toISOString(), previousAmount: oldAmount, newAmount, comment: newComment }],
  })
}
