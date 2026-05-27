import React from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '../Switch/Switch'
import styles from './AssistantEditPage.module.css'

interface AssistantEditContextSectionProps {
  contextWindow: number
  isUnlimitedContext: boolean
  onContextWindowChange: (value: number) => void
}

export const AssistantEditContextSection: React.FC<AssistantEditContextSectionProps> = ({
  contextWindow,
  isUnlimitedContext,
  onContextWindowChange
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={styles.row}>
        <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
          {t('agent.assistant.context_window_label', '上下文轮数')}
        </label>
        <div style={{ flex: 1 }} />
        {!isUnlimitedContext && (
          <span className={styles.valueText}>{Math.round(contextWindow)}</span>
        )}
        <span className={styles.descText} style={{ marginLeft: 4, marginRight: 8 }}>
          {isUnlimitedContext
            ? t('agent.assistant.context_unlimited', '无限')
            : t('agent.assistant.context_limited', '有限')}
        </span>
        <Switch
          checked={isUnlimitedContext}
          onChange={(e) => onContextWindowChange(e.target.checked ? -1 : 20)}
        />
      </div>
      {!isUnlimitedContext && (
        <div className={styles.sliderContainer}>
          <input
            type="range"
            className={styles.rangeInput}
            min={2}
            max={100}
            step={1}
            value={contextWindow}
            onChange={(e) => onContextWindowChange(Number(e.target.value))}
            style={{
              backgroundSize: `${((contextWindow - 2) * 100) / 98}% 100%`
            }}
          />
        </div>
      )}
      <div className={styles.descText}>
        {isUnlimitedContext
          ? t('agent.assistant.context_unlimited_desc', '发送所有历史消息（可能消耗大量 Token）')
          : t(
              'agent.assistant.context_window_desc',
              'How many recent conversation turns are sent to the model. One turn starts with your message and includes the assistant reply and any tool calls in that turn.'
            )}
      </div>
    </>
  )
}
