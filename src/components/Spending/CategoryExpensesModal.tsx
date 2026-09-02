import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { DeleteIcon } from '../common/DeleteIcon'
import { EntryBadges } from '../common/EntryBadges'

interface Props {
  categoryId: number
  // Omit to show every currency this category has expenses in — used by
  // Analytics, which merges a category's currencies into one line (see
  // mergeCategoryCurrencies) but should still reveal the real per-currency
  // breakdown once you actually tap in for the details.
  currency?: Currency
  categoryName: string
  categoryColor: string
  // A single "yyyy-mm" for the live Spending screen's own month-scoped
  // usage, or several for Analytics (a whole year, or the last 6 months).
  monthPrefix: string | string[]
  // Analytics shows historical spending for reference only — no delete
  // (and nothing to edit here to begin with).
  readOnly?: boolean
  totalLabel?: string
  onClose: () => void
}

export function CategoryExpensesModal({
  categoryId,
  currency,
  categoryName,
  categoryColor,
  monthPrefix,
  readOnly = false,
  totalLabel,
  onClose,
}: Props) {
  const { t, lang } = useTranslation()
  const monthPrefixes = Array.isArray(monthPrefix) ? monthPrefix : [monthPrefix]
  // Analytics (readOnly) totals only ever count spend that's already
  // happened (see AnalyticsModal's own entries filter) — this drill-down
  // has to exclude the same not-yet-happened recurring/future entries, or
  // its total silently disagrees with the figure that led here.
  const entries = useLiveQuery(
    async () =>
      (await db.spendingEntries.toArray())
        .filter(
          (e) =>
            e.categoryId === categoryId &&
            (!currency || e.currency === currency) &&
            monthPrefixes.some((m) => e.date.startsWith(m)) &&
            (!readOnly || e.date <= todayIso()),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [categoryId, currency, monthPrefixes.join(','), readOnly],
  )
  const toast = useToast()

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm(t('Delete this spending entry?'))) return
    await db.spendingEntries.delete(id)
    toast(t('Spending entry deleted'))
  }

  // Without a single currency to filter to, there's no one number to sum
  // into — show each currency's own subtotal instead of pretending they
  // add up to something.
  const totalsByCurrency = new Map<Currency, number>()
  ;(entries ?? []).forEach((e) => {
    totalsByCurrency.set(e.currency, (totalsByCurrency.get(e.currency) ?? 0) + e.amount)
  })

  return (
    <Modal
      wide={readOnly}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="swatch" style={{ background: categoryColor }} />
          {categoryName}
        </span>
      }
      onClose={onClose}
    >
      <div className="section-title">
        <span className="muted">{totalLabel ?? t('Total this month')}</span>
        <span className="entry-amount">
          {currency
            ? formatMoney(totalsByCurrency.get(currency) ?? 0, currency)
            : Array.from(totalsByCurrency.entries())
                .map(([c, amt]) => formatMoney(amt, c))
                .join(' + ') || '—'}
        </span>
      </div>

      {!entries || entries.length === 0 ? (
        <div className="empty-state">{t('No expenses in this category yet.')}</div>
      ) : (
        <div className="entry-list">
          {entries.map((e) => (
            <div className="day-entry-row" key={e.id}>
              <div className="info">
                <div className="text">
                  <div className="cat entry-badges">
                    <span>{formatDate(e.date, lang)}</span>
                    <EntryBadges
                      recurring={e.recurringExpenseId != null}
                      recurringHappened={e.date <= todayIso()}
                      upcoming={e.date > todayIso()}
                    />
                  </div>
                  {e.note && (
                    <div className="note" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
                      {e.note}
                    </div>
                  )}
                </div>
              </div>
              <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                <strong>{formatMoney(e.amount, e.currency)}</strong>
                {!readOnly && (
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e.id)} type="button">
                    <DeleteIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
