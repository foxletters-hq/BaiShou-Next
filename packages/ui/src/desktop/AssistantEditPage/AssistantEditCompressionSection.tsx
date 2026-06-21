import React from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Switch } from '../Switch/Switch'
import { formatTokens } from './assistant-edit.utils'
import styles from './AssistantEditPage.module.css'

interface AssistantEditCompressionSectionProps {
  compressThreshold: number
  compressKeepTurns: number
  isCompressDisabled: boolean
  showCompressTooltip: boolean
  showKeepTurnsTooltip: boolean
  onCompressThresholdChange: (value: number) => void
  onCompressKeepTurnsChange: (value: number) => void
  onToggleCompress: (enabled: boolean) => void
  onShowCompressTooltip: (show: boolean) => void
  onShowKeepTurnsTooltip: (show: boolean) => void
}

export const AssistantEditCompressionSection: React.FC<AssistantEditCompressionSectionProps> = ({
  compressThreshold,
  compressKeepTurns,
  isCompressDisabled,
  showCompressTooltip,
  showKeepTurnsTooltip,
  onCompressThresholdChange,
  onCompressKeepTurnsChange,
  onToggleCompress,
  onShowCompressTooltip,
  onShowKeepTurnsTooltip
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={styles.row}>
        <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
          {t('agent.assistant.compress_label', '自动压缩')}
        </label>
        <div style={{ flex: 1 }} />
        {!isCompressDisabled && (
          <span className={styles.valueText}>{formatTokens(Math.round(compressThreshold))}</span>
        )}
        <div style={{ width: 8 }} />
        <Switch
          checked={!isCompressDisabled}
          onChange={(e) => onToggleCompress(e.target.checked)}
        />
        <div style={{ width: 8, position: 'relative' }}>
          <button
            className={styles.infoButton}
            onMouseEnter={() => onShowCompressTooltip(true)}
            onMouseLeave={() => onShowCompressTooltip(false)}
            onClick={() => onShowCompressTooltip(!showCompressTooltip)}
          >
            <Info size={14} />
          </button>
          {showCompressTooltip && (
            <div className={styles.infoTooltip}>
              <p className={styles.infoTooltipText}>
                {t(
                  'agent.assistant.compress_tooltip',
                  '当对话上下文超过设定的 Token 阈值时，系统会自动压缩早期对话内容，保留最近的对话轮数。'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className={styles.descText}>
        {isCompressDisabled
          ? t('agent.assistant.compress_disabled_desc', '如果无限制上下文，超过模型上限会导致出错')
          : t('agent.assistant.compress_enabled_desc', '超过预设体积将丢弃早期会话（并自动压缩）')}
      </div>

      {!isCompressDisabled && (
        <>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              className={styles.rangeInput}
              min={10000}
              max={1000000}
              step={10000}
              value={compressThreshold}
              onChange={(e) => onCompressThresholdChange(Number(e.target.value))}
              style={{
                backgroundSize: `${((compressThreshold - 10000) * 100) / 990000}% 100%`
              }}
            />
          </div>
          <div className={styles.spacer16} />
          <div className={styles.row}>
            <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
              {t('agent.assistant.compress_keep_turns_label', '压缩后保留轮数')}
            </label>
            <div style={{ flex: 1 }} />
            <span className={styles.valueText}>
              {Math.round(compressKeepTurns)} {t('common.turns', '轮')}
            </span>
            <div style={{ width: 8, position: 'relative' }}>
              <button
                className={styles.infoButton}
                onMouseEnter={() => onShowKeepTurnsTooltip(true)}
                onMouseLeave={() => onShowKeepTurnsTooltip(false)}
                onClick={() => onShowKeepTurnsTooltip(!showKeepTurnsTooltip)}
              >
                <Info size={14} />
              </button>
              {showKeepTurnsTooltip && (
                <div className={styles.infoTooltip}>
                  <p className={styles.infoTooltipText}>
                    {t(
                      'agent.assistant.compress_keep_turns_tooltip',
                      '触发压缩时，会保留最近设定轮数的原文对话，确保上下文连贯性。'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              className={styles.rangeInput}
              min={1}
              max={10}
              step={1}
              value={compressKeepTurns}
              onChange={(e) => onCompressKeepTurnsChange(Number(e.target.value))}
              style={{
                backgroundSize: `${((compressKeepTurns - 1) * 100) / 9}% 100%`
              }}
            />
          </div>
        </>
      )}
    </>
  )
}
