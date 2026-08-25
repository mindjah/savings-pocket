import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { SavingsEntry, LoanEntry, Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_SAVINGS_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { SavingsEntryForm } from './SavingsEntryForm'
import { LoanEntryForm } from './LoanEntryForm'
import { NetWorthCard } from './NetWorthCard'
import { ExchangeRatesModal } from './ExchangeRatesModal'
import { HistoryModal } from '../common/HistoryModal'
import { HeaderPortal } from '../common/HeaderPortal'

type SubTab = 'mine' | 'lent'

export function SavingsView() {
  const [subTab, setSubTab] = useState<SubTab>('mine')
  const [savingsCurrencies] = useMetaSetting<Currency[]>('enabledSavingsCurrencies', DEFAULT_SAVINGS_CURRENCIES)

  const entries = useLiveQuery(() => db.savingsEntries.toArray(), [])
  const loans = useLiveQuery(() => db.loanEntries.toArray(), [])

  const [editingSavings, setEditingSavings] = useState<SavingsEntry | null | 'new'>(null)
  const [editingLoan, setEditingLoan] = useState<LoanEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<
    { table: 'savingsHistory' | 'loanHistory'; id: number; currency: Currency } | null
  >(null)
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
  const visibleCurrencies = CURRENCIES.filter((c) => savingsCurrencies.includes(c.code))

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
            <h2>Savings</h2>
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
                .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount)
                .map((entry) => (
                  <button className="entry-card" key={entry.id} onClick={() => setEditingSavings(entry)}>
                    <div className="entry-top">
                      <span className="entry-amount">{formatMoney(entry.amount, entry.currency)}</span>
                      <span className={`badge badge-${entry.type}`}>{entry.type === 'cash' ? 'Cash' : 'Card'}</span>
                    </div>
                    <div className="entry-sub">📍 {entry.location}</div>
                    {entry.note && (
                      <span className="note-indicator" title="Has a note" aria-label="Has a note">
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
                        if (entry.id != null) setHistoryFor({ table: 'savingsHistory', id: entry.id, currency: entry.currency })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && entry.id != null) {
                          e.stopPropagation()
                          setHistoryFor({ table: 'savingsHistory', id: entry.id, currency: entry.currency })
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
                      <span className="note-indicator" title="Has a note" aria-label="Has a note">
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
                        if (loan.id != null) setHistoryFor({ table: 'loanHistory', id: loan.id, currency: loan.currency })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && loan.id != null) {
                          e.stopPropagation()
                          setHistoryFor({ table: 'loanHistory', id: loan.id, currency: loan.currency })
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

      {historyFor && (
        <HistoryModal
          table={historyFor.table}
          entryId={historyFor.id}
          formatAmount={(n) => formatMoney(n, historyFor.currency)}
          onClose={() => setHistoryFor(null)}
        />
      )}

      {showRates && <ExchangeRatesModal onClose={() => setShowRates(false)} />}
    </div>
  )
}
