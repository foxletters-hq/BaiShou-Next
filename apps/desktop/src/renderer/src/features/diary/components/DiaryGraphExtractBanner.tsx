import React from 'react'
import { useTranslation } from 'react-i18next'

export interface DiaryGraphExtractBannerProps {
  pendingCount: number
  busy: boolean
  progressLabel?: string
  onExtract: () => void
}

/** 日记列表顶部：待整理图谱的低调提示条 */
export const DiaryGraphExtractBanner: React.FC<DiaryGraphExtractBannerProps> = ({
  pendingCount,
  busy,
  progressLabel,
  onExtract
}) => {
  const { t } = useTranslation()
  if (pendingCount <= 0 && !busy) return null

  return (
    <div className="diary-graph-extract-banner" role="status">
      <span className="diary-graph-extract-banner-text">
        {busy
          ? progressLabel || t('graph.extracting', '正在抽取…')
          : t('graph.pending_entries_hint', '有 {{count}} 篇日记还没整理', {
              count: pendingCount
            })}
      </span>
      {!busy && (
        <button type="button" className="diary-graph-extract-banner-btn" onClick={onExtract}>
          {t('graph.extract_pending_batch', '开始整理')}
        </button>
      )}
    </div>
  )
}
