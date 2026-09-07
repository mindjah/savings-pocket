import { useState } from 'react'
import { useTranslation } from '../../hooks/useTranslation'
import { ExchangeRatesModal } from '../Savings/ExchangeRatesModal'

// Duplicated here from Savings' own desktop header row — desktop moved it
// to the Dashboard's top-right corner instead (mobile keeps its own copy
// in Savings, via HeaderPortal).
export function CurrencyRatesButton() {
  const { t } = useTranslation()
  const [showRates, setShowRates] = useState(false)

  return (
    <>
      <button className="btn btn-accent-text" onClick={() => setShowRates(true)} type="button">
        {t('Exchange rates')}
        <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: 18 }} aria-hidden="true" />
      </button>
      {showRates && <ExchangeRatesModal onClose={() => setShowRates(false)} />}
    </>
  )
}
