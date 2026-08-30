import { useState } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney, parseAmount, roundFiat } from '../../lib/format'
import { convertFiat } from '../../lib/fxRates'
import { useFiatRates } from '../../hooks/useFiatRates'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

export function ExchangeRatesModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { rates, fetchedAt, stale, error, loading, refresh } = useFiatRates()

  const [fromCurrency, setFromCurrency] = useState<Currency>('EUR')
  const [toCurrency, setToCurrency] = useState<Currency>('USD')
  const [activeSide, setActiveSide] = useState<'from' | 'to'>('from')
  const [rawAmount, setRawAmount] = useState('1')

  const parsedRaw = parseAmount(rawAmount)
  const converted = (source: Currency, target: Currency) => {
    if (!rates || Number.isNaN(parsedRaw)) return ''
    return String(roundFiat(convertFiat(parsedRaw, source, target, rates), target))
  }
  const fromValue = activeSide === 'from' ? rawAmount : converted(toCurrency, fromCurrency)
  const toValue = activeSide === 'to' ? rawAmount : converted(fromCurrency, toCurrency)

  return (
    <Modal title={t('Exchange rates')} onClose={onClose}>
      <div className="section-title">
        <span className="muted">{t('Currency converter')}</span>
      </div>
      <div className="card settings-list">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <input
              type="text"
              inputMode="decimal"
              value={fromValue}
              onChange={(e) => {
                setActiveSide('from')
                setRawAmount(e.target.value)
              }}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <input
              type="text"
              inputMode="decimal"
              value={toValue}
              onChange={(e) => {
                setActiveSide('to')
                setRawAmount(e.target.value)
              }}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="section-title">
        <span className="muted">{t('Currency exchange rates')}</span>
        <button
          className="btn btn-ghost"
          onClick={() => refresh({ force: true })}
          disabled={loading}
          type="button"
        >
          {loading ? t('Refreshing…') : t('↻ Refresh')}
        </button>
      </div>

      {!rates ? (
        <div className="muted">{loading ? t('Loading…') : t('Exchange rates unavailable.')}</div>
      ) : (
        <div className="history-list">
          {CURRENCIES.filter((c) => c.code !== 'USD').map((c) => (
            <div className="history-item" key={c.code}>
              <div className="entry-top">
                <span>
                  {c.symbol} {c.code}
                </span>
                <strong>1 USD = {formatMoney(rates[c.code], c.code)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
      {fetchedAt && (
        <div className="muted">
          {t(stale ? 'Using last known rates (offline)' : 'Updated')} {new Date(fetchedAt).toLocaleString()}
          {error ? ` — ${error}` : ''}
        </div>
      )}
    </Modal>
  )
}
