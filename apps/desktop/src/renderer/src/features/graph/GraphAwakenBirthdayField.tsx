import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@baishou/ui'
import styles from './GraphAwakenBirthdayField.module.css'

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const raw = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return null
  return { y, m, d }
}

function todayParts(): { y: number; m: number; d: number } {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toYmd(y: number, m: number, d: number): string {
  const daysInMonth = new Date(y, m, 0).getDate()
  const safeDay = Math.min(d, daysInMonth)
  return `${y}-${pad2(m)}-${pad2(safeDay)}`
}

function birthdayYearRange(): number[] {
  const end = new Date().getFullYear()
  const start = 1900
  const years: number[] = []
  for (let y = start; y <= end; y += 1) years.push(y)
  return years
}

function scrollSelectedToCenter(root: HTMLElement | null) {
  if (!root) return
  const selected = root.querySelectorAll(`.${styles.colItemSelected}`)
  selected.forEach((el) => {
    const container = el.parentElement
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const targetRect = (el as HTMLElement).getBoundingClientRect()
    const targetCenterY = targetRect.top + targetRect.height / 2
    const containerCenterY = containerRect.top + containerRect.height / 2
    container.scrollTop = container.scrollTop + (targetCenterY - containerCenterY)
  })
}

export interface GraphAwakenBirthdayFieldProps {
  value: string
  onChange: (ymd: string) => void
  disabled?: boolean
  hasError?: boolean
  placeholder?: string
}

/** 生日：点击触发器后在主内容圆角卡内弹出选择器 */
export const GraphAwakenBirthdayField: React.FC<GraphAwakenBirthdayFieldProps> = ({
  value,
  onChange,
  disabled = false,
  hasError = false,
  placeholder
}) => {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const years = useMemo(() => birthdayYearRange(), [])
  const parsed = parseYmd(value)
  const today = useMemo(() => todayParts(), [])
  const [pickerYear, setPickerYear] = useState(parsed?.y ?? today.y)
  const [pickerMonth, setPickerMonth] = useState(parsed?.m ?? today.m)
  const [pickerDay, setPickerDay] = useState(parsed?.d ?? today.d)

  useEffect(() => {
    if (!open) return
    const p = parseYmd(value)
    const next = p ?? todayParts()
    setPickerYear(next.y)
    setPickerMonth(next.m)
    setPickerDay(next.d)
  }, [open, value])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const run = () => {
      if (!cancelled) scrollSelectedToCenter(panelRef.current)
    }
    const id0 = requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    const t1 = window.setTimeout(run, 50)
    const t2 = window.setTimeout(run, 120)
    const t3 = window.setTimeout(run, 320)
    return () => {
      cancelled = true
      cancelAnimationFrame(id0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [open, pickerYear, pickerMonth, pickerDay])

  const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate()
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )

  useEffect(() => {
    if (pickerDay > daysInMonth) setPickerDay(daysInMonth)
  }, [pickerDay, daysInMonth])

  const label = parsed
    ? t('graph.awaken_birthday_value', '{{year}}年{{month}}月{{day}}日', {
        year: parsed.y,
        month: parsed.m,
        day: parsed.d
      })
    : placeholder || t('graph.awaken_birthday_placeholder', '选择你的生日')

  const close = () => setOpen(false)

  const confirm = () => {
    onChange(toYmd(pickerYear, pickerMonth, pickerDay))
    setOpen(false)
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={hasError ? `${styles.trigger} ${styles.triggerError}` : styles.trigger}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={parsed ? styles.triggerValue : styles.triggerPlaceholder}>{label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} />
      </button>

      <Modal
        isOpen={open}
        onClose={close}
        closeOnOverlayClick
        animation="fade"
        className={styles.modal}
        aria-label={t('graph.awaken_birthday_label', '生日')}
      >
        <div className={styles.panel} ref={panelRef}>
          <div className={styles.header}>
            <button type="button" className={styles.cancelBtn} onClick={close}>
              {t('common.cancel', '取消')}
            </button>
            <span className={styles.headerTitle}>
              {t('graph.awaken_birthday_label', '生日')}
            </span>
            <button type="button" className={styles.confirmBtn} onClick={confirm}>
              {t('common.confirm', '确认')}
            </button>
          </div>
          <div className={styles.divider} />
          <div className={styles.columns}>
            <div className={styles.column}>
              <div className={styles.colLabel}>{t('common.year_unit_label', '年')}</div>
              <div className={styles.colScroll}>
                <div className={styles.colPad} aria-hidden />
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={y === pickerYear ? styles.colItemSelected : styles.colItem}
                    onClick={() => setPickerYear(y)}
                  >
                    {y}
                  </button>
                ))}
                <div className={styles.colPad} aria-hidden />
              </div>
            </div>
            <div className={styles.column}>
              <div className={styles.colLabel}>{t('common.month_unit_label', '月')}</div>
              <div className={styles.colScroll}>
                <div className={styles.colPad} aria-hidden />
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={m === pickerMonth ? styles.colItemSelected : styles.colItem}
                    onClick={() => setPickerMonth(m)}
                  >
                    {m}
                  </button>
                ))}
                <div className={styles.colPad} aria-hidden />
              </div>
            </div>
            <div className={styles.column}>
              <div className={styles.colLabel}>{t('common.day_unit_label', '日')}</div>
              <div className={styles.colScroll}>
                <div className={styles.colPad} aria-hidden />
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={d === pickerDay ? styles.colItemSelected : styles.colItem}
                    onClick={() => setPickerDay(d)}
                  >
                    {d}
                  </button>
                ))}
                <div className={styles.colPad} aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
