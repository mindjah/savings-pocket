import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { SavingsEntry, Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { SavingsEntryForm } from './SavingsEntryForm'
import { HistoryModal } from '../common/HistoryModal'

export function SavingsView() {
  const entries = useLiveQuery(() => db.savingsEntries.toArray(), [])
  const [editing, setEditing] = useState<SavingsEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<SavingsEntry | null>(null)
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('EUR')

  const totals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0 }
  entries?.forEach((e) => {
    totals[e.currency] += e.amount
  })

  return (
    <div className="view">
      <div className="totals-row">
        {CURRENCIES.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{c.code}</div>
            <div className="amount">{formatMoney(totals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

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
              <button className="entry-card" key={entry.id} onClick={() => setEditing(entry)}>
                <div className="entry-top">
                  <span className="entry-amount">{formatMoney(entry.amount, entry.currency)}</span>
                  <span className={`badge badge-${entry.type}`}>{entry.type === 'cash' ? 'Cash' : 'Card'}</span>
                </div>
                <div className="entry-sub">📍 {entry.location}</div>
                {entry.note && <div className="entry-note">{entry.note}</div>}
                <div
                  role="link"
                  tabIndex={0}
                  className="muted"
                  style={{ textDecoration: 'underline', width: 'fit-content' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setHistoryFor(entry)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      setHistoryFor(entry)
                    }
                  }}
                >
                  View history
                </div>
              </button>
            ))}
        </div>
      )}

      <button
        className="fab"
        aria-label="Add savings entry"
        onClick={() => {
          setDefaultCurrency('EUR')
          setEditing('new')
        }}
      >
        +
      </button>

      {editing && (
        <SavingsEntryForm
          entry={editing === 'new' ? null : editing}
          defaultCurrency={defaultCurrency}
          onClose={() => setEditing(null)}
        />
      )}

      {historyFor?.id != null && (
        <HistoryModal
          table="savingsHistory"
          entryId={historyFor.id}
          formatAmount={(n) => formatMoney(n, historyFor.currency)}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}
