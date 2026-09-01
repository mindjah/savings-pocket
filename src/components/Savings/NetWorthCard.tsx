import { useState } from 'react'
import type { Currency } from '../../db/types'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'
import { useTranslation } from '../../hooks/useTranslation'
import { ChevronDownIcon } from '../common/ChevronDownIcon'

export function NetWorthCard() {
  const { t } = useTranslation()
  const [displayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const [includeCreditsInNetWorth] = useMetaSetting<boolean>('includeCreditsInNetWorth', false)
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency, includeCreditsInNetWorth)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card net-worth-card">
      <div className="section-title">
        <h2>{t('Total net worth')}</h2>
        {breakdown && (
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {formatMoney(breakdown.grandTotal, displayCurrency)}
          </span>
        )}
      </div>

      {expanded &&
        (!breakdown ? (
          <div className="muted">{loading ? t('Calculating…') : t('Exchange rates unavailable.')}</div>
        ) : (
          <>
            <div className="muted" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>
                {t('Savings')}: {formatMoney(breakdown.savingsTotal, displayCurrency)}
              </span>
              <span>
                {t('For spending')}: {formatMoney(breakdown.spendingTotal, displayCurrency)}
              </span>
              <span>
                {t('Crypto')}: {formatMoney(breakdown.cryptoTotal, displayCurrency)}
              </span>
              <span>
                {t('Lent out')}: {formatMoney(breakdown.loansTotal, displayCurrency)}
              </span>
              {includeCreditsInNetWorth && (
                <span>
                  {t('Credits')}: {formatMoney(breakdown.creditsTotal, displayCurrency)}
                </span>
              )}
            </div>
            {stale && (
              <div className="muted" style={{ marginTop: 8 }}>
                {error ? `${t('Using last known rates —')} ${error}` : t('Using last known exchange rates (offline).')}
              </div>
            )}
          </>
        ))}

      <button
        type="button"
        className={`card-expand-toggle${expanded ? ' open' : ''}`}
        aria-label={t(expanded ? 'Hide details' : 'Show details')}
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronDownIcon size={20} />
      </button>
    </div>
  )
}
