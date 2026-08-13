import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  clampGraphMonthRange,
  defaultGraphMonthRange,
  formatGraphMonth,
  isDefaultGraphMonthRange,
  parseGraphMonthToDate,
  type GraphMonthRange
} from '@baishou/shared'
import { withAppContentOverlay } from '@baishou/ui'
import styles from './GraphMonthRangePicker.module.css'

export interface GraphMonthRangePickerProps {
  value: GraphMonthRange
  onChange: (next: GraphMonthRange) => void
  /** Extra class on the trigger button (e.g. full-width in sidebar). */
  className?: string
  /** Stretch trigger to full container width (sidebar). */
  block?: boolean
}

type EditTarget = 'start' | 'end'

function yearList(now = new Date()): number[] {
  const end = now.getFullYear()
  const start = 2000
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function monthLabel(
  monthNames: string[] | unknown,
  month: string
): string {
  const d = parseGraphMonthToDate(month)
  const names = Array.isArray(monthNames) ? (monthNames as string[]) : null
  const name = names?.[d.getMonth()] ?? `${d.getMonth() + 1}月`
  return `${d.getFullYear()} ${name}`
}

function rangeFromMonthsBack(months: number): GraphMonthRange {
  return defaultGraphMonthRange(new Date(), months)
}

export const GraphMonthRangePicker: React.FC<GraphMonthRangePickerProps> = ({
  value,
  onChange,
  className,
  block
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<GraphMonthRange>(value)
  const [editTarget, setEditTarget] = useState<EditTarget>('start')
  const [viewYear, setViewYear] = useState(() => parseGraphMonthToDate(value.startMonth).getFullYear())
  const overlayRef = useRef<HTMLDivElement>(null)
  const yearListRef = useRef<HTMLDivElement>(null)

  const monthNames = t('common.months', { returnObjects: true }) as string[]
  const years = useMemo(() => yearList(), [])
  const isRecent3 = isDefaultGraphMonthRange(value)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setEditTarget('start')
    setViewYear(parseGraphMonthToDate(value.startMonth).getFullYear())
  }, [open, value])

  useEffect(() => {
    if (!open || !yearListRef.current) return
    const active = yearListRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ block: 'center' })
  }, [open, viewYear])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const activeMonth = editTarget === 'start' ? draft.startMonth : draft.endMonth

  const selectMonth = (monthIndex: number) => {
    const nextMonth = formatGraphMonth(new Date(viewYear, monthIndex, 1))
    setDraft((prev) => {
      if (editTarget === 'start') {
        const startMonth = nextMonth
        const endMonth = startMonth > prev.endMonth ? startMonth : prev.endMonth
        return { startMonth, endMonth }
      }
      const endMonth = nextMonth
      const startMonth = endMonth < prev.startMonth ? endMonth : prev.startMonth
      return { startMonth, endMonth }
    })
    if (editTarget === 'start') setEditTarget('end')
  }

  const applyDraft = () => {
    onChange(clampGraphMonthRange(draft))
    setOpen(false)
  }

  const applyPreset = (months: number) => {
    const next = rangeFromMonthsBack(months)
    setDraft(next)
    onChange(next)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${isRecent3 ? styles.triggerDefault : styles.triggerCustom}${
          block ? ` ${styles.triggerBlock}` : ''
        }${className ? ` ${className}` : ''}`}
        title={t('graph.month_range_hint', '按日记关系所属月份筛选')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <CalendarDays size={15} className={styles.triggerIcon} />
        <span className={styles.triggerText}>
          <span className={styles.triggerRange}>
            {monthLabel(monthNames, value.startMonth)}
            <span className={styles.triggerDash}>—</span>
            {monthLabel(monthNames, value.endMonth)}
          </span>
          <span className={styles.triggerBadge}>
            {isRecent3
              ? t('graph.month_range_recent3', '近3月')
              : t('graph.month_range_custom', '自定义')}
          </span>
        </span>
        <ChevronRight size={14} className={styles.triggerChevron} />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open ? (
              <motion.div
                ref={overlayRef}
                className={withAppContentOverlay(styles.overlay)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(e) => {
                  if (e.target === overlayRef.current) setOpen(false)
                }}
              >
                <motion.div
                  className={styles.modal}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('graph.month_range_dialog', '选择月份范围')}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                >
                  <div className={styles.modalHeader}>
                    <div>
                      <div className={styles.modalTitle}>
                        {t('graph.month_range_dialog', '选择月份范围')}
                      </div>
                      <div className={styles.modalSubtitle}>
                        {t(
                          'graph.month_range_dialog_hint',
                          '先选起始月，再选结束月；图谱只展示该区间内的关系。'
                        )}
                      </div>
                    </div>
                    <div className={styles.preview}>
                      {monthLabel(monthNames, draft.startMonth)}
                      <span className={styles.triggerDash}>—</span>
                      {monthLabel(monthNames, draft.endMonth)}
                    </div>
                  </div>

                  <div className={styles.targetTabs} role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={editTarget === 'start'}
                      className={`${styles.targetTab} ${editTarget === 'start' ? styles.targetTabActive : ''}`}
                      onClick={() => {
                        setEditTarget('start')
                        setViewYear(parseGraphMonthToDate(draft.startMonth).getFullYear())
                      }}
                    >
                      <span className={styles.targetTabLabel}>
                        {t('graph.month_range_start', '起始月')}
                      </span>
                      <span className={styles.targetTabValue}>
                        {monthLabel(monthNames, draft.startMonth)}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={editTarget === 'end'}
                      className={`${styles.targetTab} ${editTarget === 'end' ? styles.targetTabActive : ''}`}
                      onClick={() => {
                        setEditTarget('end')
                        setViewYear(parseGraphMonthToDate(draft.endMonth).getFullYear())
                      }}
                    >
                      <span className={styles.targetTabLabel}>
                        {t('graph.month_range_end', '结束月')}
                      </span>
                      <span className={styles.targetTabValue}>
                        {monthLabel(monthNames, draft.endMonth)}
                      </span>
                    </button>
                  </div>

                  <div className={styles.pickerBody}>
                    <div className={styles.yearPane} ref={yearListRef}>
                      {years.map((y) => {
                        const active = viewYear === y
                        const selectedYear = parseGraphMonthToDate(activeMonth).getFullYear() === y
                        return (
                          <button
                            key={y}
                            type="button"
                            data-active={active}
                            className={`${styles.yearItem} ${active ? styles.yearItemActive : ''} ${selectedYear && !active ? styles.yearItemSelected : ''}`}
                            onClick={() => setViewYear(y)}
                          >
                            {y}
                          </button>
                        )
                      })}
                    </div>
                    <div className={styles.monthPane}>
                      {Array.from({ length: 12 }, (_, i) => i).map((m) => {
                        const month = formatGraphMonth(new Date(viewYear, m, 1))
                        const selected = activeMonth === month
                        const inRange = month >= draft.startMonth && month <= draft.endMonth
                        const isNow =
                          viewYear === new Date().getFullYear() && m === new Date().getMonth()
                        return (
                          <button
                            key={month}
                            type="button"
                            className={`${styles.monthBtn} ${inRange ? styles.monthBtnInRange : ''} ${selected ? styles.monthBtnSelected : ''} ${isNow && !selected ? styles.monthBtnNow : ''}`}
                            onClick={() => selectMonth(m)}
                          >
                            {Array.isArray(monthNames) ? monthNames[m] : m + 1}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className={styles.presets}>
                    <button type="button" className={styles.presetBtn} onClick={() => applyPreset(3)}>
                      {t('graph.month_range_recent3', '近3月')}
                    </button>
                    <button type="button" className={styles.presetBtn} onClick={() => applyPreset(6)}>
                      {t('graph.month_range_recent6', '近6月')}
                    </button>
                    <button
                      type="button"
                      className={styles.presetBtn}
                      onClick={() => applyPreset(12)}
                    >
                      {t('graph.month_range_recent12', '近1年')}
                    </button>
                  </div>

                  <div className={styles.footer}>
                    <button
                      type="button"
                      className={styles.footerGhost}
                      onClick={() => setOpen(false)}
                    >
                      {t('common.cancel', '取消')}
                    </button>
                    <button type="button" className={styles.footerPrimary} onClick={applyDraft}>
                      {t('graph.month_range_apply', '应用')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
