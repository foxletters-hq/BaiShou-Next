import React from 'react'
import { useTranslation } from 'react-i18next'

export interface DiaryStatusBarProps {
  showPendingExtract: boolean
  pendingExtractCount: number
  showPendingEmbed: boolean
  pendingEmbedCount: number
  onPendingExtractClick?: () => void
  onPendingEmbedClick?: () => void
  /** false = 只读展示（移动端） */
  interactive?: boolean
}

/** 日记列表常驻底栏：待抽取 / 待嵌入（能力未配置或 count=0 时不显示对应项） */
export const DiaryStatusBar: React.FC<DiaryStatusBarProps> = ({
  showPendingExtract,
  pendingExtractCount,
  showPendingEmbed,
  pendingEmbedCount,
  onPendingExtractClick,
  onPendingEmbedClick,
  interactive = true
}) => {
  const { t } = useTranslation()
  const hasItems = showPendingExtract || showPendingEmbed

  return (
    <div className="diary-status-bar" role="status">
      {showPendingExtract ? (
        interactive && onPendingExtractClick ? (
          <button
            type="button"
            className="diary-status-bar-item diary-status-bar-item--action"
            onClick={onPendingExtractClick}
          >
            {t('diary.status_pending_extract', '待抽取：{{count}}个', {
              count: pendingExtractCount
            })}
          </button>
        ) : (
          <span className="diary-status-bar-item">
            {t('diary.status_pending_extract', '待抽取：{{count}}个', {
              count: pendingExtractCount
            })}
          </span>
        )
      ) : null}
      {showPendingEmbed ? (
        interactive && onPendingEmbedClick ? (
          <button
            type="button"
            className="diary-status-bar-item diary-status-bar-item--action"
            onClick={onPendingEmbedClick}
          >
            {t('diary.status_pending_embed', '待嵌入：{{count}}个', {
              count: pendingEmbedCount
            })}
          </button>
        ) : (
          <span className="diary-status-bar-item">
            {t('diary.status_pending_embed', '待嵌入：{{count}}个', {
              count: pendingEmbedCount
            })}
          </span>
        )
      ) : null}
      {!hasItems ? <span className="diary-status-bar-spacer" /> : null}
    </div>
  )
}
