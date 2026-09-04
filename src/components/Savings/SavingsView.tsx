import { useEffect, useRef, useState } from 'react'
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
import { useTranslation } from '../../hooks/useTranslation'
import { CardIcon } from '../common/CardIcon'
import { CashIcon } from '../common/CashIcon'
import { TransferIcon } from '../common/TransferIcon'
import { TransferModal } from './TransferModal'
import { EntryActionMenu } from '../common/EntryActionMenu'

type SubTab = 'mine' | 'credits' | 'lent'

interface Props {
  resetKey: number
}

export function SavingsView({ resetKey }: Props) {
  const { t } = useTranslation()
  const [subTab, setSubTab] = useState<SubTab>('mine')

  // resetKey bumps when the user re-taps the already-active Savings nav tab —
  // jump back to My money, skipping the very first render (that's not a re-tap).
  const isFirstResetRef = useRef(true)
  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    setSubTab('mine')
  }, [resetKey])
  // Settings > Security's persisted default — only Settings' own toggle
  // writes to it. The net worth card's eye button flips the local copy
  // below instead, so tapping it only shows/hides balances for the current
  // visit; it never changes what you'll see next time you open the app.
  const [blurBalancesDefault] = useMetaSetting<boolean>('blurBalances', false)
  const [blurBalances, setBlurBalances] = useState(blurBalancesDefault)
  useEffect(() => {
    setBlurBalances(blurBalancesDefault)
  }, [blurBalancesDefault])
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

  const allEntries = useLiveQuery(() => db.savingsEntries.toArray(), [])
  const entries = allEntries?.filter((e) => e.kind !== 'credit')
  const credits = allEntries?.filter((e) => e.kind === 'credit')
  const loans = useLiveQuery(() => db.loanEntries.toArray(), [])

  const [editingSavings, setEditingSavings] = useState<SavingsEntry | null | 'new'>(null)
  const [editingLoan, setEditingLoan] = useState<LoanEntry | null | 'new'>(null)
  const [adjustingPocket, setAdjustingPocket] = useState<SavingsEntry | null>(null)
  const [pocketHistoryFor, setPocketHistoryFor] = useState<{ id: number; currency: Currency } | null>(null)
  const [loanHistoryFor, setLoanHistoryFor] = useState<{ id: number; currency: Currency } | null>(null)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [showRates, setShowRates] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const defaultCurrency = savingsCurrencies[0] ?? 'EUR'

  const savingsTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  entries?.forEach((e) => {
    savingsTotals[e.currency] += e.amount
  })

  const creditTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  credits?.forEach((e) => {
    creditTotals[e.currency] += e.amount
  })

  const loanTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  loans?.forEach((l) => {
    loanTotals[l.currency] += l.amount
  })

  const totals = subTab === 'mine' ? savingsTotals : subTab === 'credits' ? creditTotals : loanTotals
  const enabledCurrencies = CURRENCIES.filter((c) => savingsCurrencies.includes(c.code))
  // Credits/Lent out only show currencies that actually have an entry — no point showing a
  // permanent row of empty chips for currencies you've simply enabled elsewhere.
  const visibleCurrencies =
    subTab === 'mine'
      ? enabledCurrencies
      : subTab === 'credits'
        ? enabledCurrencies.filter((c) => creditTotals[c.code] !== 0)
        : enabledCurrencies.filter((c) => loanTotals[c.code] > 0)

  function pocketTint(entry: SavingsEntry): string {
    if (entry.kind === 'credit') return 'tint-red'
    if (entry.purpose === 'savings') return 'tint-green'
    if (entry.purpose === 'spending') return 'tint-orange'
    return 'tint-indigo'
  }

  function renderPocketCard(entry: SavingsEntry) {
    return (
      <div className="entry-card" key={entry.id}>
        <div className="entry-top">
          <span className="entry-top-left">
            <span className={`pocket-type-icon ${pocketTint(entry)}`} aria-hidden="true">
              {entry.type === 'cash' ? <CashIcon size={24} /> : <CardIcon size={24} />}
            </span>
            <span className="entry-amount">{formatMoney(entry.amount, entry.currency)}</span>
            {entry.kind === 'pocket' && entry.purpose && (
              <span className={`badge badge-${entry.purpose}`}>
                {t(entry.purpose === 'savings' ? 'Savings' : 'Spending')}
              </span>
            )}
          </span>
          <button
            className="pocket-adjust-btn"
            aria-label="Adjust balance"
            onClick={() => setAdjustingPocket(entry)}
          >
            +
          </button>
        </div>
        <div className="entry-sub-row">
          <div className="entry-sub pocket-name">
            📍 {entry.location} {t(entry.type === 'cash' ? 'Cash' : 'Card')}
          </div>
        </div>
        <EntryActionMenu
          onEdit={() => setEditingSavings(entry)}
          onViewHistory={() => entry.id != null && setPocketHistoryFor({ id: entry.id, currency: entry.currency })}
          onSeeNote={entry.note ? () => setViewingNote(entry.note) : undefined}
        />
      </div>
    )
  }

  function sortPockets(list: SavingsEntry[]) {
    return list.slice().sort((a, b) => {
      if (trackingMode === 'auto') {
        const aDefault = a.id != null && defaultPocketIds.has(a.id)
        const bDefault = b.id != null && defaultPocketIds.has(b.id)
        if (aDefault !== bDefault) return aDefault ? -1 : 1
      }
      return comparableValue(b) - comparableValue(a)
    })
  }

  return (
    <div className={`view boucoup-scope${blurBalances ? ' balances-blurred' : ''}`}>
      <HeaderPortal>
        <button className="btn btn-accent-text" onClick={() => setShowRates(true)} type="button">
          {t('Exchange rates')}
          <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: 18 }} aria-hidden="true" />
        </button>
      </HeaderPortal>

      <div className="desktop-header-row">
        <button className="btn btn-accent-text" onClick={() => setShowRates(true)} type="button">
          {t('Exchange rates')}
          <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: 18 }} aria-hidden="true" />
        </button>
      </div>

      <NetWorthCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />

      <div className="segmented">
        <button type="button" className={subTab === 'mine' ? 'active' : ''} onClick={() => setSubTab('mine')}>
          {t('My money')}
        </button>
        <button type="button" className={subTab === 'lent' ? 'active' : ''} onClick={() => setSubTab('lent')}>
          {t('Lent out')}
        </button>
        <button type="button" className={subTab === 'credits' ? 'active' : ''} onClick={() => setSubTab('credits')}>
          {t('Credits')}
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

      <div className="subtab-content" key={subTab}>
      {subTab === 'mine' ? (
        <>
          <div className="section-title section-title-bottom">
            <h2>{t('My Pockets')}</h2>
            {entries && entries.length > 0 && (
              <button className="btn btn-transfer" onClick={() => setShowTransfer(true)} type="button">
                {t('Transfer')}
                <TransferIcon size={14} />
              </button>
            )}
          </div>

          {!entries ? null : entries.length === 0 ? (
            <div className="empty-state">
              <span className="icon">💰</span>
              {t('No savings tracked yet. Tap + to add your first entry.')}
            </div>
          ) : (
            <div className="entry-list">{sortPockets(entries).map(renderPocketCard)}</div>
          )}
        </>
      ) : subTab === 'credits' ? (
        <>
          <div className="section-title section-title-bottom">
            <h2>{t('Credits')}</h2>
            {credits && credits.length > 0 && (
              <button className="btn btn-transfer" onClick={() => setShowTransfer(true)} type="button">
                {t('Transfer')}
                <TransferIcon size={14} />
              </button>
            )}
          </div>

          {!credits ? null : credits.length === 0 ? (
            <div className="empty-state">
              <span className="icon">💳</span>
              {t('No credits tracked yet. Tap + to add money you owe.')}
            </div>
          ) : (
            <div className="entry-list">{sortPockets(credits).map(renderPocketCard)}</div>
          )}
        </>
      ) : (
        <>
          <div className="section-title section-title-bottom">
            <h2>{t('Lent out')}</h2>
            {loans && loans.length > 0 && (
              <button className="btn btn-transfer" onClick={() => setShowTransfer(true)} type="button">
                {t('Transfer')}
                <TransferIcon size={14} />
              </button>
            )}
          </div>

          {!loans ? null : loans.length === 0 ? (
            <div className="empty-state">
              <span className="icon">🤝</span>
              {t("No loans tracked yet. Tap + to add money you've lent someone.")}
            </div>
          ) : (
            <div className="entry-list">
              {loans
                .slice()
                .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount)
                .map((loan) => (
                  <div className="entry-card" key={loan.id}>
                    <div className="entry-top">
                      <span className="entry-amount">{formatMoney(loan.amount, loan.currency)}</span>
                      <span className="badge">{loan.borrowerName}</span>
                    </div>
                    <EntryActionMenu
                      onEdit={() => setEditingLoan(loan)}
                      onViewHistory={() => loan.id != null && setLoanHistoryFor({ id: loan.id, currency: loan.currency })}
                      onSeeNote={loan.note ? () => setViewingNote(loan.note) : undefined}
                    />
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      </div>

      <button
        className="fab"
        aria-label={t(subTab === 'mine' ? 'Add savings pocket' : subTab === 'credits' ? 'Add credit' : 'Add loan')}
        onClick={() => (subTab === 'lent' ? setEditingLoan('new') : setEditingSavings('new'))}
      >
        +
      </button>

      {editingSavings && (
        <SavingsEntryForm
          entry={editingSavings === 'new' ? null : editingSavings}
          kind={editingSavings === 'new' ? (subTab === 'credits' ? 'credit' : 'pocket') : editingSavings.kind}
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

      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} />}
    </div>
  )
}
