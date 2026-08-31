import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  cacheHitPercent,
  clampRingPercent,
  formatContextTokenCount,
  lastRoundUsagePercent,
  sumLastRoundTokens,
  type LastRoundTokenUsage
} from '@baishou/shared'
import { withAppContentOverlay } from '../overlay'
import styles from './ContextUsageRing.module.css'

const RING_SIZE = 16
const RING_STROKE = 2
const PANEL_WIDTH = 300
const PANEL_GAP = 8
const VIEW_PAD = 12

export interface ContextUsageCumulative {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCost: string
}

export interface ContextUsageRingProps {
  lastRound: LastRoundTokenUsage | null
  contextWindow: number
  cumulative: ContextUsageCumulative
  pricingLastUpdated?: Date | null
  onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>
  pricingSourceUrl?: string
}

function ringTone(percent: number): 'idle' | 'warn' | 'alert' {
  if (percent >= 90) return 'alert'
  if (percent >= 75) return 'warn'
  return 'idle'
}

function computePanelCoords(anchorRect: DOMRect, height: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = anchorRect.right - PANEL_WIDTH
  let top = anchorRect.top - height - PANEL_GAP
  if (top < VIEW_PAD) {
    top = Math.min(anchorRect.bottom + PANEL_GAP, vh - height - VIEW_PAD)
  }
  left = Math.max(VIEW_PAD, Math.min(left, vw - PANEL_WIDTH - VIEW_PAD))
  top = Math.max(VIEW_PAD, Math.min(top, vh - height - VIEW_PAD))
  return { left, top }
}

function formatPricingUpdated(
  date: Date | null | undefined,
  unknownLabel: string
): string {
  if (!date) return unknownLabel
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export const ContextUsageRing: React.FC<ContextUsageRingProps> = ({
  lastRound,
  contextWindow,
  cumulative,
  pricingLastUpdated,
  onRefreshPricing,
  pricingSourceUrl
}) => {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const usedTokens = lastRound ? sumLastRoundTokens(lastRound) : 0
  const hitPercent = lastRound ? cacheHitPercent(lastRound) : null
  const percent = lastRoundUsagePercent(usedTokens, contextWindow)
  const ringPercent = clampRingPercent(percent)
  const tone = ringTone(ringPercent)
  const radius = (RING_SIZE - RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - ringPercent / 100)
  const sourceUrl = pricingSourceUrl || 'https://models.dev'

  const usageLabel = useMemo(() => {
    if (percent == null) {
      return t('agent.context_usage_unknown', '上下文占用未知')
    }
    return t('agent.context_usage_percent', '上一轮上下文占用 {{percent}}%', {
      percent
    })
  }, [percent, t])

  const placePanel = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? 480
    if (!anchor) return
    setCoords(computePanelCoords(anchor, height))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    placePanel()
  }, [open, placePanel, lastRound, cumulative, pricingLastUpdated, refreshError])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onResize = () => placePanel()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, placePanel])

  const handleRefresh = useCallback(async () => {
    if (!onRefreshPricing || isRefreshing) return
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const result = await onRefreshPricing()
      if (!result.success && result.error) setRefreshError(result.error)
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : t('agent.chat.pricing_refresh_failed', '刷新失败')
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefreshPricing, isRefreshing, t])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${styles[tone]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={usageLabel}
        title={usageLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          className={styles.ring}
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden
        >
          <circle
            className={styles.track}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
          />
          <circle
            className={styles.fill}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
      </button>

      {open
        ? createPortal(
            <>
              <div
                className={withAppContentOverlay(styles.overlay)}
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                className={styles.panel}
                role="dialog"
                aria-label={t('agent.context_usage_detail_title', '上下文占用')}
                style={{ left: coords.left, top: coords.top }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>
                    {t('agent.context_usage_detail_title', '上下文占用')}
                  </span>
                  <span className={styles.panelPercent}>
                    {percent == null
                      ? t('agent.context_usage_no_window', '窗口未知')
                      : `${percent}%`}
                  </span>
                </div>
                <p className={styles.panelSummary}>
                  {lastRound == null
                    ? t('agent.context_usage_no_last_round', '还没有上一轮用量')
                    : percent == null
                      ? t('agent.context_usage_no_window', '窗口未知')
                      : `${formatContextTokenCount(usedTokens)} / ${formatContextTokenCount(contextWindow)}`}
                </p>
                <div className={styles.barTrack} aria-hidden>
                  <div className={`${styles.barFill} ${styles[tone]}`} style={{ width: `${ringPercent}%` }} />
                </div>

                <h3 className={styles.sectionTitle}>
                  {t('agent.context_usage_last_round', '上一轮用量')}
                </h3>
                {lastRound ? (
                  <>
                    <div className={styles.row}>
                      <span>{t('agent.chat.round_input', '输入')}</span>
                      <span>{lastRound.inputTokens.toLocaleString()}</span>
                    </div>
                    <div className={styles.row}>
                      <span>{t('agent.chat.round_output', '输出')}</span>
                      <span>{lastRound.outputTokens.toLocaleString()}</span>
                    </div>
                    {lastRound.cacheReadInputTokens > 0 ? (
                      <div className={styles.row}>
                        <span>{t('agent.chat.cost_cumulative_cache_read', '缓存读取')}</span>
                        <span>{lastRound.cacheReadInputTokens.toLocaleString()}</span>
                      </div>
                    ) : null}
                    {lastRound.cacheWriteInputTokens > 0 ? (
                      <div className={styles.row}>
                        <span>{t('agent.chat.cost_cumulative_cache_write', '缓存写入')}</span>
                        <span>{lastRound.cacheWriteInputTokens.toLocaleString()}</span>
                      </div>
                    ) : null}
                    {hitPercent != null ? (
                      <div className={styles.row}>
                        <span>{t('agent.context_usage_cache_hit', '缓存命中')}</span>
                        <span>{hitPercent}%</span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={styles.emptyHint}>
                    {t('agent.context_usage_no_last_round', '还没有上一轮用量')}
                  </p>
                )}

                <div className={styles.divider} />

                <h3 className={styles.sectionTitle}>
                  {t('agent.chat.cost_cumulative_title', '累计 API 消耗')}
                </h3>
                <div className={styles.row}>
                  <span>{t('agent.chat.cost_cumulative_total', '累计费用')}</span>
                  <span>{cumulative.estimatedCost}</span>
                </div>
                <div className={styles.row}>
                  <span>{t('agent.chat.cost_cumulative_input', '累计输入')}</span>
                  <span>
                    {cumulative.inputTokens.toLocaleString()} {t('agent.chat.tokens_unit', 'tokens')}
                  </span>
                </div>
                <div className={styles.row}>
                  <span>{t('agent.chat.cost_cumulative_output', '累计输出')}</span>
                  <span>
                    {cumulative.outputTokens.toLocaleString()} {t('agent.chat.tokens_unit', 'tokens')}
                  </span>
                </div>
                {cumulative.cacheReadTokens > 0 ? (
                  <div className={styles.row}>
                    <span>{t('agent.chat.cost_cumulative_cache_read', '缓存读取')}</span>
                    <span>
                      {cumulative.cacheReadTokens.toLocaleString()}{' '}
                      {t('agent.chat.tokens_unit', 'tokens')}
                    </span>
                  </div>
                ) : null}
                {cumulative.cacheWriteTokens > 0 ? (
                  <div className={styles.row}>
                    <span>{t('agent.chat.cost_cumulative_cache_write', '缓存写入')}</span>
                    <span>
                      {cumulative.cacheWriteTokens.toLocaleString()}{' '}
                      {t('agent.chat.tokens_unit', 'tokens')}
                    </span>
                  </div>
                ) : null}

                <div className={styles.divider} />

                <h3 className={styles.sectionTitle}>
                  {t('agent.chat.pricing_table_title', '价格表信息')}
                </h3>
                <div className={styles.row}>
                  <span>{t('agent.chat.pricing_last_updated', '最后更新')}</span>
                  <span>
                    {formatPricingUpdated(
                      pricingLastUpdated,
                      t('agent.chat.pricing_unknown', '未知')
                    )}
                  </span>
                </div>
                <div className={styles.row}>
                  <span>{t('agent.chat.pricing_source', '价格数据源')}</span>
                  <span className={styles.pricingActions}>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      {t('agent.chat.pricing_source_name', '价格目录')}
                    </a>
                    {onRefreshPricing ? (
                      <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={() => void handleRefresh()}
                        disabled={isRefreshing}
                      >
                        {isRefreshing
                          ? t('agent.chat.pricing_refreshing', '刷新中...')
                          : t('agent.chat.pricing_refresh', '刷新')}
                      </button>
                    ) : null}
                  </span>
                </div>
                {refreshError ? <p className={styles.error}>{refreshError}</p> : null}
                <p className={styles.disclaimer}>
                  {t(
                    'agent.chat.cost_disclaimer',
                    '提示：此费用计算数据来自本地 pricing 规则，存在更新不及时或计费方式不同的情况，仅供参考。'
                  )}
                </p>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  )
}
