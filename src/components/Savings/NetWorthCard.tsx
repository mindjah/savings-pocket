import { useState } from 'react'
import type { Currency } from '../../db/types'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'
import { useTranslation } from '../../hooks/useTranslation'
import { ChevronDownIcon } from '../common/ChevronDownIcon'
import { EyeIcon } from '../common/EyeIcon'
import { EyeOffIcon } from '../common/EyeOffIcon'

export function NetWorthCard() {
  const { t } = useTranslation()
  const [displayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const [includeCreditsInNetWorth] = useMetaSetting<boolean>('includeCreditsInNetWorth', false)
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency, includeCreditsInNetWorth)
  const [expanded, setExpanded] = useState(false)
  // Same switch as Settings > Security "Blur balances" — this button is
  // just a quick way to flip it without leaving the Savings screen.
  const [blurBalances, setBlurBalances] = useMetaSetting<boolean>('blurBalances', false)

  return (
    <div className="card net-worth-card">
      <button
        className="net-worth-eye-toggle"
        type="button"
        onClick={() => setBlurBalances(!blurBalances)}
        aria-label={t(blurBalances ? 'Show balances' : 'Hide balances')}
      >
        {blurBalances ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
      <div className="net-worth-label">{t('Total net worth')}</div>
      {breakdown ? (
        <div className="net-worth-amount">{formatMoney(breakdown.grandTotal, displayCurrency)}</div>
      ) : (
        <div className="muted">{loading ? t('Calculating…') : t('Exchange rates unavailable.')}</div>
      )}

      {expanded && breakdown && (
        <>
          <div className="net-worth-breakdown muted">
            <span>
              {t('Savings')}: <span className="net-worth-breakdown-amount">{formatMoney(breakdown.savingsTotal, displayCurrency)}</span>
            </span>
            <span>
              {t('For spending')}:{' '}
              <span className="net-worth-breakdown-amount">{formatMoney(breakdown.spendingTotal, displayCurrency)}</span>
            </span>
            <span>
              {t('Crypto')}: <span className="net-worth-breakdown-amount">{formatMoney(breakdown.cryptoTotal, displayCurrency)}</span>
            </span>
            <span>
              {t('Lent out')}: <span className="net-worth-breakdown-amount">{formatMoney(breakdown.loansTotal, displayCurrency)}</span>
            </span>
            {includeCreditsInNetWorth && (
              <span>
                {t('Credits')}: <span className="net-worth-breakdown-amount">{formatMoney(breakdown.creditsTotal, displayCurrency)}</span>
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
