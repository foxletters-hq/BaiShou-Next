import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatLocalDate } from '@baishou/shared'
import { withAppContentOverlay } from '../overlay'
import {
  parseDateInput,
  getCalendarDays,
  getDecadeYears,
  type CalendarDayCell
} from './date-picker.util'
import { resolveDatePickerPlacement } from './date-picker-placement.util'
import styles from './DatePicker.module.css'

export interface DatePickerProps {
  value?: Date | string | null
  onChange?: (date: Date | null, dateString: string) => void
  placeholder?: string
  size?: 'medium' | 'small'
  disabled?: boolean
  clearable?: boolean
  minDate?: Date | string | null
  maxDate?: Date | string | null
  className?: string
  id?: string
  name?: string
  'aria-label'?: string
  mode?: 'date' | 'month' | 'year'
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder,
  size = 'medium',
  disabled = false,
  clearable = true,
  minDate,
  maxDate,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
  mode = 'date'
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day')
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedDate = useMemo(() => parseDateInput(value), [value])
  const selectedYmd = useMemo(
    () => (selectedDate ? formatLocalDate(selectedDate) : ''),
    [selectedDate]
  )

  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(() => selectedDate?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => selectedDate?.getMonth() ?? today.getMonth())

  const yearUnit = t('common.year_unit_label', '年')

  const monthNames = useMemo(() => {
    const loaded = t('common.months', { returnObjects: true })
    if (Array.isArray(loaded) && loaded.length >= 12) return loaded as string[]
    return [
      t('common.month_1', '1月'),
      t('common.month_2', '2月'),
      t('common.month_3', '3月'),
      t('common.month_4', '4月'),
      t('common.month_5', '5月'),
      t('common.month_6', '6月'),
      t('common.month_7', '7月'),
      t('common.month_8', '8月'),
      t('common.month_9', '9月'),
      t('common.month_10', '10月'),
      t('common.month_11', '11月'),
      t('common.month_12', '12月')
    ]
  }, [t])

  const weekdays = useMemo(
    () => [
      t('common.weekday_mon_short', '一'),
      t('common.weekday_tue_short', '二'),
      t('common.weekday_wed_short', '三'),
      t('common.weekday_thu_short', '四'),
      t('common.weekday_fri_short', '五'),
      t('common.weekday_sat_short', '六'),
      t('common.weekday_sun_short', '日')
    ],
    [t]
  )

  useEffect(() => {
    if (isOpen) {
      const target = selectedDate ?? new Date()
      setViewYear(target.getFullYear())
      setViewMonth(target.getMonth())
      setViewMode(mode === 'month' ? 'month' : mode === 'year' ? 'year' : 'day')
    }
  }, [isOpen, selectedDate, mode])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const pos = resolveDatePickerPlacement(
      {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width
      },
      { width: window.innerWidth, height: window.innerHeight }
    )
    setDropdownPos(pos)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    updatePosition()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, updatePosition])

  const handleToggle = () => {
    if (disabled) return
    setIsOpen((prev) => !prev)
  }

  const handleSelectDay = (dayCell: CalendarDayCell) => {
    if (dayCell.isDisabled) return
    onChange?.(dayCell.date, dayCell.ymd)
    setIsOpen(false)
  }

  const handleSelectToday = () => {
    const now = new Date()
    onChange?.(now, formatLocalDate(now))
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(null, '')
    setIsOpen(false)
  }

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth, selectedDate, minDate, maxDate),
    [viewYear, viewMonth, selectedDate, minDate, maxDate]
  )

  const decadeYears = useMemo(() => getDecadeYears(viewYear), [viewYear])

  const displayPlaceholder = placeholder || t('common.select_date', '选择日期')

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const prevYear = () => setViewYear((y) => y - 1)
  const nextYear = () => setViewYear((y) => y + 1)
  const prevDecade = () => setViewYear((y) => y - 10)
  const nextDecade = () => setViewYear((y) => y + 10)

  const startDecadeYear = Math.floor(viewYear / 10) * 10
  const decadeTitle = `${startDecadeYear} - ${startDecadeYear + 9}`

  return (
    <div
      className={`${styles.container} ${className} ${disabled ? styles.disabled : ''} ${size === 'small' ? styles.sizeSmall : styles.sizeMedium}`.trim()}
    >
      <input type="hidden" name={name} value={selectedYmd} />
      <div
        ref={triggerRef}
        id={id}
        className={`${styles.trigger} ${isOpen ? styles.isOpen : ''}`}
        onClick={handleToggle}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel || displayPlaceholder}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <div className={styles.triggerBody}>
          <Calendar size={size === 'small' ? 14 : 16} className={styles.calendarIcon} />
          {selectedYmd ? (
            <span className={styles.valueText}>{selectedYmd}</span>
          ) : (
            <span className={styles.placeholderText}>{displayPlaceholder}</span>
          )}
        </div>
        <div className={styles.triggerActions}>
          {clearable && selectedYmd && !disabled ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              title={t('common.clear', '清除')}
              aria-label={t('common.clear', '清除')}
            >
              <X size={13} />
            </button>
          ) : null}
          <ChevronDown
            size={14}
            className={`${styles.chevronIcon} ${isOpen ? styles.chevronRotated : ''}`}
          />
        </div>
      </div>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className={withAppContentOverlay(styles.overlay)}
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={dropdownRef}
              className={styles.dropdown}
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              role="dialog"
              aria-modal="true"
              aria-label={t('common.select_date', '选择日期')}
            >
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.navGroup}>
                  {viewMode === 'day' ? (
                    <>
                      <button
                        type="button"
                        className={styles.navBtn}
                        onClick={prevYear}
                        title={t('calendar.prev_year', '上一年')}
                        aria-label={t('calendar.prev_year', '上一年')}
                      >
                        <ChevronsLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.navBtn}
                        onClick={prevMonth}
                        title={t('calendar.prev_month', '上一月')}
                        aria-label={t('calendar.prev_month', '上一月')}
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.navBtn}
                      onClick={viewMode === 'year' ? prevDecade : prevYear}
                      title={t('calendar.prev_page', '上一页')}
                      aria-label={t('calendar.prev_page', '上一页')}
                    >
                      <ChevronsLeft size={16} />
                    </button>
                  )}
                </div>

                <div className={styles.titleGroup}>
                  {viewMode === 'day' ? (
                    <>
                      <button
                        type="button"
                        className={styles.titleBtn}
                        onClick={() => setViewMode('year')}
                      >
                        {viewYear}
                        {yearUnit}
                      </button>
                      <button
                        type="button"
                        className={styles.titleBtn}
                        onClick={() => setViewMode('month')}
                      >
                        {monthNames[viewMonth]}
                      </button>
                    </>
                  ) : viewMode === 'month' ? (
                    <button
                      type="button"
                      className={styles.titleBtn}
                      onClick={() => setViewMode('year')}
                    >
                      {viewYear}
                      {yearUnit}
                    </button>
                  ) : (
                    <span className={styles.titleBtn}>{decadeTitle}</span>
                  )}
                </div>

                <div className={styles.navGroup}>
                  {viewMode === 'day' ? (
                    <>
                      <button
                        type="button"
                        className={styles.navBtn}
                        onClick={nextMonth}
                        title={t('calendar.next_month', '下一月')}
                        aria-label={t('calendar.next_month', '下一月')}
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.navBtn}
                        onClick={nextYear}
                        title={t('calendar.next_year', '下一年')}
                        aria-label={t('calendar.next_year', '下一年')}
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.navBtn}
                      onClick={viewMode === 'year' ? nextDecade : nextYear}
                      title={t('calendar.next_page', '下一页')}
                      aria-label={t('calendar.next_page', '下一页')}
                    >
                      <ChevronsRight size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Day View */}
              {viewMode === 'day' ? (
                <>
                  <div className={styles.weekdaysRow}>
                    {weekdays.map((w) => (
                      <span key={w} className={styles.weekdayCell}>
                        {w}
                      </span>
                    ))}
                  </div>

                  <div className={styles.daysGrid}>
                    {calendarDays.map((cell) => {
                      const classNames = [
                        styles.dayCell,
                        !cell.isCurrentMonth ? styles.dayOtherMonth : '',
                        cell.isToday ? styles.dayToday : '',
                        cell.isSelected ? styles.daySelected : '',
                        cell.isDisabled ? styles.dayDisabled : ''
                      ]
                        .filter(Boolean)
                        .join(' ')

                      return (
                        <button
                          key={cell.ymd}
                          type="button"
                          className={classNames}
                          disabled={cell.isDisabled}
                          onClick={() => handleSelectDay(cell)}
                        >
                          {cell.day}
                        </button>
                      )
                    })}
                  </div>

                  <div className={styles.footer}>
                    {clearable && selectedYmd ? (
                      <button
                        type="button"
                        className={`${styles.footerBtn} ${styles.footerBtnSecondary}`}
                        onClick={handleClear}
                      >
                        {t('common.clear', '清除')}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" className={styles.footerBtn} onClick={handleSelectToday}>
                      {t('common.today', '今天')}
                    </button>
                  </div>
                </>
              ) : null}

              {/* Month View */}
              {viewMode === 'month' ? (
                <div className={styles.grid3x4}>
                  {monthNames.map((nameStr, idx) => {
                    const isSelected = selectedDate
                      ? selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === idx
                      : false
                    return (
                      <button
                        key={nameStr}
                        type="button"
                        className={`${styles.gridCell} ${isSelected ? styles.gridCellSelected : ''}`}
                        onClick={() => {
                          setViewMonth(idx)
                          setViewMode('day')
                        }}
                      >
                        {nameStr}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {/* Year View */}
              {viewMode === 'year' ? (
                <div className={styles.grid3x4}>
                  {decadeYears.map((yr, idx) => {
                    const isSelected = selectedDate ? selectedDate.getFullYear() === yr : false
                    const isDimmed = idx === 0 || idx === decadeYears.length - 1
                    return (
                      <button
                        key={yr}
                        type="button"
                        className={`${styles.gridCell} ${isSelected ? styles.gridCellSelected : ''} ${isDimmed ? styles.gridCellDimmed : ''}`}
                        onClick={() => {
                          setViewYear(yr)
                          setViewMode('month')
                        }}
                      >
                        {yr}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </>,
          document.body
        )}
    </div>
  )
}
