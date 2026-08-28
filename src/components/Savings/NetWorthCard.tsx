import type { Currency } from '../../db/types'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'
import { useTranslation } from '../../hooks/useTranslation'

export function NetWorthCard() {
  const { t } = useTranslation()
  const [displayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const [includeCreditsInNetWorth] = useMetaSetting<boolean>('includeCreditsInNetWorth', false)
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency, includeCreditsInNetWorth)

  return (
    <div className="card">
      <div className="section-title">
        <h2>{t('Total net worth')}</h2>
        {breakdown && (
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {formatMoney(breakdown.grandTotal, displayCurrency)}
          </span>
        )}
      </div>

      {!breakdown ? (
        <div className="muted">{loading ? t('Calculating…') : t('Exchange rates unavailable.')}</div>
      ) : (
        <>
          <div className="muted" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span>
              {t('Savings')}: {formatMoney(breakdown.savingsTotal, displayCurrency)}
            </span>
            <span>
              {t('Spending')}: {formatMoney(breakdown.spendingTotal, displayCurrency)}
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
      )}
    </div>
  )
}
