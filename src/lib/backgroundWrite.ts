// Auto-backup (see useAutoBackup) watches every backed-up table for ANY
// change and can't tell "the app did this automatically" from "the user
// just edited something" — both look like the same table write. A few
// things write to those same tables with no user action at all: recurring
// expenses/pending auto-debits materializing on app open (see
// materializeRecurringExpenses, materializePendingAutoDebits), and a
// crypto holding's trend-arrow baseline price refreshing the first time a
// live price loads after an edit (see InvestView). Left unaddressed, those
// alone can trigger a Drive push with nothing the user did to explain it —
// which is exactly what shows up later as a surprising "newer backup this
// device hasn't seen" conflict on another device.
//
// This is a short suppression WINDOW, not a per-write flag matched to a
// specific change — Dexie's liveQuery notices a write asynchronously, some
// unpredictable (if short) time after the transaction that caused it
// commits, so there's no single moment to toggle a flag off cleanly. A few
// seconds of "ignore any table change noticed right now" comfortably
// covers that gap. The cost of getting the window's length slightly wrong
// is asymmetric on purpose: too short just means auto-backup occasionally
// still fires on one of these (no worse than before this existed); too
// long, on the rare chance a real edit lands in the same window, only
// delays that edit's backup until the next change — it still isn't lost.
const SUPPRESS_WINDOW_MS = 3000

let suppressUntil = 0

export function markBackgroundWrite(): void {
  suppressUntil = Date.now() + SUPPRESS_WINDOW_MS
}

export function isWithinBackgroundWriteWindow(): boolean {
  return Date.now() < suppressUntil
}
