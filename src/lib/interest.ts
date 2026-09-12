import { db } from '../db/db'
import { markBackgroundWrite } from './backgroundWrite'
import { roundFiat, todayIso } from './format'

function addOneDay(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Noon UTC rather than midnight — formatDateOrTime/isToday compare in local
// time, and noon UTC lands on the same calendar day for every real-world
// timezone offset, so a catch-up day never displays as the day before or
// after the one it's actually for.
function dayToIsoInstant(dateIso: string): string {
  return `${dateIso}T12:00:00.000Z`
}

// Catches up every savings pocket with an interest rate set to today,
// crediting one day's interest per elapsed day (same "don't just credit
// once, fill in every day that was due" shape as materializeRecurringExpenses)
// — so a long-closed app still shows a full daily trail once reopened.
//
// Each day's gross interest is computed fresh from that day's real,
// already-rounded starting balance (this app keeps every pocket's amount
// rounded to its currency at all times — see roundFiat's other call
// sites — there's no hidden extra-precision ledger behind it). Gross, tax,
// and net are each rounded independently rather than derived by subtracting
// already-rounded figures, which is why two days with an identical-looking
// rounded gross can still show tax landing a cent apart — the same kind of
// rounding a real bank's own daily interest breakdown shows.
export async function materializeSavingsInterest(): Promise<void> {
  const today = todayIso()
  await db.transaction('rw', db.savingsEntries, db.savingsHistory, async () => {
    const pockets = await db.savingsEntries.toArray()
    const due = pockets.filter(
      (p) => p.kind === 'pocket' && p.purpose === 'savings' && (p.interestRateAER ?? 0) > 0 && p.interestLastAccrued,
    )

    for (const pocket of due) {
      const dailyRate = pocket.interestRateAER! / 100 / 365
      const taxRatePct = pocket.interestTaxRate ?? 0
      const withheld = (pocket.interestTaxMode ?? 'withheld') === 'withheld'
      const comment = withheld
        ? `Daily interest — ${pocket.interestRateAER}% AER, ${taxRatePct}% tax withheld`
        : `Daily interest — ${pocket.interestRateAER}% AER, ${taxRatePct}% tax tracked separately`

      let balance = pocket.amount
      let cursor = addOneDay(pocket.interestLastAccrued!)
      let taxTrackedDelta = 0
      let creditedAnyDay = false

      while (cursor <= today) {
        const grossPrecise = balance * dailyRate
        const taxPrecise = grossPrecise * (taxRatePct / 100)
        const gross = roundFiat(grossPrecise, pocket.currency)
        const tax = roundFiat(taxPrecise, pocket.currency)
        const net = roundFiat(grossPrecise - taxPrecise, pocket.currency)
        const credited = withheld ? net : gross
        const previousAmount = balance
        balance = roundFiat(balance + credited, pocket.currency)
        if (!withheld) taxTrackedDelta = roundFiat(taxTrackedDelta + tax, pocket.currency)

        await db.savingsHistory.add({
          entryId: pocket.id!,
          previousAmount,
          newAmount: balance,
          date: dayToIsoInstant(cursor),
          comment,
          source: 'interest',
          interestGross: gross,
          interestTax: tax,
        })

        creditedAnyDay = true
        cursor = addOneDay(cursor)
      }

      if (creditedAnyDay) {
        await db.savingsEntries.update(pocket.id!, {
          amount: balance,
          interestLastAccrued: today,
          ...(taxTrackedDelta > 0 ? { interestTaxTracked: roundFiat((pocket.interestTaxTracked ?? 0) + taxTrackedDelta, pocket.currency) } : {}),
        })
      }
    }
  })
  markBackgroundWrite()
}
