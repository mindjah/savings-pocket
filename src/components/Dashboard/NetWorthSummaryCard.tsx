import type { Currency } from '../../db/types'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'
import { useTranslation } from '../../hooks/useTranslation'
import { EyeIcon } from '../common/EyeIcon'
import { EyeOffIcon } from '../common/EyeOffIcon'

interface Props {
  blurBalances: boolean
  onToggleBlur: () => void
}

// A standard-size dashboard card version of Savings' own big gradient hero
// (NetWorthCard) — same useNetWorth data, but sized like every other
// dashboard card and with the breakdown always visible instead of behind
// an expand toggle, since the point of a dashboard is to show it all at a
// glance.
export function NetWorthSummaryCard({ blurBalances, onToggleBlur }: Props) {
  const { t } = useTranslation()
  const [displayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const [includeCreditsInNetWorth] = useMetaSetting<boolean>('includeCreditsInNetWorth', false)
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency, includeCreditsInNetWorth)

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-green" aria-hidden="true">
          <i className="fa-solid fa-wallet" aria-hidden="true" />
        </span>
        <h3>{t('Total net worth')}</h3>
        <button
          className="dashboard-card-eye-toggle"
          type="button"
          onClick={onToggleBlur}
          aria-label={t(blurBalances ? 'Show balances' : 'Hide balances')}
        >
          {blurBalances ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>

      {breakdown ? (
        <strong className="dashboard-card-total">{formatMoney(breakdown.grandTotal, displayCurrency)}</strong>
      ) : (
        <div className="muted">{loading ? t('Calculating…') : t('Exchange rates unavailable.')}</div>
      )}

      {breakdown && (
        <div className="dashboard-card-list">
          <div className="dashboard-card-list-row">
            <span className="muted">{t('Savings')}</span>
            <span className="dashboard-networth-line">{formatMoney(breakdown.savingsTotal, displayCurrency)}</span>
          </div>
          <div className="dashboard-card-list-row">
            <span className="muted">{t('For spending')}</span>
            <span className="dashboard-networth-line">{formatMoney(breakdown.spendingTotal, displayCurrency)}</span>
          </div>
          <div className="dashboard-card-list-row">
            <span className="muted">{t('Crypto')}</span>
            <span className="dashboard-networth-line">{formatMoney(breakdown.cryptoTotal, displayCurrency)}</span>
          </div>
          <div className="dashboard-card-list-row">
            <span className="muted">{t('Lent out')}</span>
            <span className="dashboard-networth-line">{formatMoney(breakdown.loansTotal, displayCurrency)}</span>
          </div>
          {includeCreditsInNetWorth && (
            <div className="dashboard-card-list-row">
              <span className="muted">{t('Credits')}</span>
              <span className="dashboard-networth-line">{formatMoney(breakdown.creditsTotal, displayCurrency)}</span>
            </div>
          )}
        </div>
      )}

      {stale && (
        <div className="muted" style={{ marginTop: 8 }}>
          {error ? `${t('Using last known rates —')} ${error}` : t('Using last known exchange rates (offline).')}
        </div>
      )}
    </div>
  )
}
