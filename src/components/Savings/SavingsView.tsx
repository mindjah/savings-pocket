import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { SavingsEntry, LoanEntry, Currency, SavingsTrackingMode } from '../../db/types'
import { CURRENCIES, DEFAULT_SAVINGS_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useFiatRates } from '../../hooks/useFiatRates'
import { convertFiat } from '../../lib/fxRates'
import { SavingsEntryForm } from './SavingsEntryForm'
import { LoanEntryForm } from './LoanEntryForm'
import { NetWorthCard } from './NetWorthCard'
import { ExchangeRatesModal } from './ExchangeRatesModal'
import { AdjustPocketModal } from './AdjustPocketModal'
import { PocketHistoryModal } from './PocketHistoryModal'
import { HistoryModal } from '../common/HistoryModal'
import { HeaderPortal } from '../common/HeaderPortal'
import { NoteViewModal } from '../common/NoteViewModal'

type SubTab = 'mine' | 'lent'

export function SavingsView() {
  const [subTab, setSubTab] = useState<SubTab>('mine')
  const [savingsCurrencies] = useMetaSetting<Currency[]>('enabledSavingsCurrencies', DEFAULT_SAVINGS_CURRENCIES)
  const [trackingMode] = useMetaSetting<SavingsTrackingMode>('savingsTrackingMode', 'manual')
  const [defaultPockets] = useMetaSetting<Partial<Record<Currency, number>>>('defaultSavingsPocketByCurrency', {})
  const defaultPocketIds = new Set(Object.values(defaultPockets).filter((id): id is number => id != null))
  const { rates: fxRates } = useFiatRates()
  // Amounts are in different currencies, so raw numbers aren't comparable (3000 EUR is
  // worth far more than 80000 RUB) — convert to a common currency for sort comparisons.
  function comparableValue(entry: { amount: number; currency: Currency }): number {
    return fxRates ? convertFiat(entry.amount, entry.currency, 'USD', fxRates) : entry.amount
  }

  const entries = useLiveQuery(() => db.savingsEntries.toArray(), [])
  const loans = useLiveQuery(() => db.loanEntries.toArray(), [])

  const [editingSavings, setEditingSavings] = useState<SavingsEntry | null | 'new'>(null)
  const [editingLoan, setEditingLoan] = useState<LoanEntry | null | 'new'>(null)
  const [adjustingPocket, setAdjustingPocket] = useState<SavingsEntry | null>(null)
  const [pocketHistoryFor, setPocketHistoryFor] = useState<{ id: number; currency: Currency } | null>(null)
  const [loanHistoryFor, setLoanHistoryFor] = useState<{ id: number; currency: Currency } | null>(null)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [showRates, setShowRates] = useState(false)

  const defaultCurrency = savingsCurrencies[0] ?? 'EUR'

  const savingsTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  entries?.forEach((e) => {
    savingsTotals[e.currency] += e.amount
  })

  const loanTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  loans?.forEach((l) => {
    loanTotals[l.currency] += l.amount
  })

  const totals = subTab === 'mine' ? savingsTotals : loanTotals
  const enabledCurrencies = CURRENCIES.filter((c) => savingsCurrencies.includes(c.code))
  // Lent out only shows currencies that actually have a loan — no point showing a
  // permanent row of empty chips for currencies you've simply enabled elsewhere.
  const visibleCurrencies =
    subTab === 'mine' ? enabledCurrencies : enabledCurrencies.filter((c) => loanTotals[c.code] > 0)

  return (
    <div className="view">
      <HeaderPortal>
        <button className="btn btn-accent-text" onClick={() => setShowRates(true)} type="button">
          Exchange rates
        </button>
      </HeaderPortal>

      <div className="desktop-header-row">
        <button className="btn btn-accent-text" onClick={() => setShowRates(true)} type="button">
          Exchange rates
        </button>
      </div>

      <NetWorthCard />

      <div className="segmented">
        <button type="button" className={subTab === 'mine' ? 'active' : ''} onClick={() => setSubTab('mine')}>
          My money
        </button>
        <button type="button" className={subTab === 'lent' ? 'active' : ''} onClick={() => setSubTab('lent')}>
          Lent out
        </button>
      </div>

      <div className="totals-row">
        {visibleCurrencies.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{c.code}</div>
            <div className="amount">{formatMoney(totals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      {subTab === 'mine' ? (
        <>
          <div className="section-title">
            <h2>Saving Pockets</h2>
          </div>

          {!entries || entries.length === 0 ? (
            <div className="empty-state">
              <span className="icon">💰</span>
              No savings tracked yet. Tap + to add your first entry.
            </div>
          ) : (
            <div className="entry-list">
              {entries
                .slice()
                .sort((a, b) => {
                  if (trackingMode === 'auto') {
                    const aDefault = a.id != null && defaultPocketIds.has(a.id)
                    const bDefault = b.id != null && defaultPocketIds.has(b.id)
                    if (aDefault !== bDefault) return aDefault ? -1 : 1
                  }
                  return comparableValue(b) - comparableValue(a)
                })
                .map((entry) => (
                  <div
                    className="entry-card"
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingSavings(entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setEditingSavings(entry)
                    }}
                  >
                    <div className="entry-top">
                      <span className="entry-top-left">
                        <span className="entry-amount">{formatMoney(entry.amount, entry.currency)}</span>
                        <span className={`badge badge-${entry.type}`}>{entry.type === 'cash' ? 'Cash' : 'Card'}</span>
                        {trackingMode === 'auto' && entry.id != null && defaultPocketIds.has(entry.id) && (
                          <span className="badge badge-default">Default</span>
                        )}
                      </span>
                      <button
                        className="pocket-adjust-btn"
                        aria-label="Adjust balance"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAdjustingPocket(entry)
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div className="entry-sub">📍 {entry.location}</div>
                    {entry.note && (
                      <span
                        className="note-indicator note-indicator-text"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingNote(entry.note)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            setViewingNote(entry.note)
                          }
                        }}
                      >
                        See note
                      </span>
                    )}
                    <div
                      role="link"
                      tabIndex={0}
                      className="pocket-link-text"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (entry.id != null) setPocketHistoryFor({ id: entry.id, currency: entry.currency })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && entry.id != null) {
                          e.stopPropagation()
                          setPocketHistoryFor({ id: entry.id, currency: entry.currency })
                        }
                      }}
                    >
                      History
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-title">
            <h2>Lent out</h2>
          </div>

          {!loans || loans.length === 0 ? (
            <div className="empty-state">
              <span className="icon">🤝</span>
              No loans tracked yet. Tap + to add money you've lent someone.
            </div>
          ) : (
            <div className="entry-list">
              {loans
                .slice()
                .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount)
                .map((loan) => (
                  <button className="entry-card" key={loan.id} onClick={() => setEditingLoan(loan)}>
                    <div className="entry-top">
                      <span className="entry-amount">{formatMoney(loan.amount, loan.currency)}</span>
                      <span className="badge">{loan.borrowerName}</span>
                    </div>
                    {loan.note && (
                      <span
                        className="note-indicator"
                        title="Has a note"
                        aria-label="Has a note"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingNote(loan.note)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            setViewingNote(loan.note)
                          }
                        }}
                      >
                        📝
                      </span>
                    )}
                    <div
                      role="link"
                      tabIndex={0}
                      className="muted"
                      style={{ textDecoration: 'underline', width: 'fit-content' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (loan.id != null) setLoanHistoryFor({ id: loan.id, currency: loan.currency })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && loan.id != null) {
                          e.stopPropagation()
                          setLoanHistoryFor({ id: loan.id, currency: loan.currency })
                        }
                      }}
                    >
                      View history
                    </div>
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      <button
        className="fab"
        aria-label={subTab === 'mine' ? 'Add savings entry' : 'Add loan'}
        onClick={() => (subTab === 'mine' ? setEditingSavings('new') : setEditingLoan('new'))}
      >
        +
      </button>

      {editingSavings && (
        <SavingsEntryForm
          entry={editingSavings === 'new' ? null : editingSavings}
          defaultCurrency={defaultCurrency}
          availableCurrencies={savingsCurrencies}
          onClose={() => setEditingSavings(null)}
        />
      )}

      {editingLoan && (
        <LoanEntryForm
          entry={editingLoan === 'new' ? null : editingLoan}
          defaultCurrency={defaultCurrency}
          availableCurrencies={savingsCurrencies}
          onClose={() => setEditingLoan(null)}
        />
      )}

      {adjustingPocket && <AdjustPocketModal entry={adjustingPocket} onClose={() => setAdjustingPocket(null)} />}

      {pocketHistoryFor && (
        <PocketHistoryModal
          entryId={pocketHistoryFor.id}
          currency={pocketHistoryFor.currency}
          onClose={() => setPocketHistoryFor(null)}
        />
      )}

      {loanHistoryFor && (
        <HistoryModal
          table="loanHistory"
          entryId={loanHistoryFor.id}
          formatAmount={(n) => formatMoney(n, loanHistoryFor.currency)}
          onClose={() => setLoanHistoryFor(null)}
        />
      )}

      {viewingNote != null && <NoteViewModal note={viewingNote} onClose={() => setViewingNote(null)} />}

      {showRates && <ExchangeRatesModal onClose={() => setShowRates(false)} />}
    </div>
  )
}
