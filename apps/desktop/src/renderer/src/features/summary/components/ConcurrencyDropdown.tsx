import React from 'react'
import { useTranslation } from 'react-i18next'
import { Gauge } from 'lucide-react'

interface ConcurrencyDropdownProps {
  value: number
  onChange: (n: number) => void
  disabled: boolean
}

export const ConcurrencyDropdown: React.FC<ConcurrencyDropdownProps> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  return (
    <div className="concurrency-dropdown">
      <button
        className="concurrency-trigger"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
      >
        <Gauge size={14} className="concurrency-trigger-icon" />
        <span className="concurrency-trigger-text">
          {t('summary.concurrency', '并发')}: {value}
        </span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div className="concurrency-menu">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`concurrency-option ${n === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(n)
                  setOpen(false)
                }}
              >
                {t('summary.concurrency', '并发')}: {n}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
