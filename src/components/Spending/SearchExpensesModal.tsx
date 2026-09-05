import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'
import { EntryBadges } from '../common/EntryBadges'

interface Props {
  onClose: () => void
}

// One search box across every real spending entry (any month) — matches if
// the query appears anywhere in the category name, note, currency code, or
// the amount (raw or formatted), rather than separate fields for each.
export function SearchExpensesModal({ onClose }: Props) {
  const { t, lang } = useTranslation()
  const [query, setQuery] = useState('')
  const entries = useLiveQuery(() => db.spendingEntries.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return entries
      .filter((e) => {
        const category = categoryMap.get(e.categoryId)
        const haystack = [category?.name, e.note, e.currency, String(e.amount), formatMoney(e.amount, e.currency)]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, categoryMap, query])

  return (
    <Modal title={t('Search expenses')} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search by amount, currency, category, or note')}
        />
      </div>

      {query.trim() === '' ? (
        <div className="empty-state">
          <span className="icon">🔍</span>
          {t('Start typing to search your expenses.')}
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">{t('No matching expenses found.')}</div>
      ) : (
        <div className="entry-list">
          {results.map((e) => {
            const category = categoryMap.get(e.categoryId)
            return (
              <div className="day-entry-row" key={e.id}>
                <div className="info">
                  <span className="swatch" style={{ background: category?.color ?? '#888' }} />
                  <div className="text">
                    <div className="cat entry-badges">
                      <span>{category?.name ?? t('Unknown')}</span>
                      <EntryBadges
                        recurring={e.recurringExpenseId != null}
                        recurringHappened={e.date <= todayIso()}
                        upcoming={e.date > todayIso()}
                      />
                    </div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      {formatDate(e.date, lang)}
                    </div>
                    {e.note && (
                      <div className="note" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
                        {e.note}
                      </div>
                    )}
                  </div>
                </div>
                <strong>{formatMoney(e.amount, e.currency)}</strong>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
