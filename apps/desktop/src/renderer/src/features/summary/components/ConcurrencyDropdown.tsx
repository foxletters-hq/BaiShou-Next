import React from 'react'
import { useTranslation } from 'react-i18next'
import { Gauge } from 'lucide-react'

interface ConcurrencyDropdownProps {
  value: number
  onChange: (n: number) => void
  disabled: boolean
}

export const ConcurrencyDropdown: React.FC<ConcurrencyDropdownProps> = ({
  value,
  onChange,
  disabled
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const [direction, setDirection] = React.useState<'up' | 'down'>('down')

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // 菜单高度大概 180px，若下方剩余空间不足 200px 则往上弹出
      if (spaceBelow < 200) {
        setDirection('up')
      } else {
        setDirection('down')
      }
    }
  }, [open])

  return (
    <div className="concurrency-dropdown">
      <button
        ref={triggerRef}
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
          <div
            className="concurrency-menu"
            style={
              direction === 'up'
                ? { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: '4px' }
                : {}
            }
          >
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
