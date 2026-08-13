import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ReasoningEffortSetting } from '@baishou/shared'
import {
  REASONING_EFFORTS,
  normalizeReasoningEffortSetting,
  formatReasoningEffortLabel
} from '@baishou/shared'

export type ReasoningEffortSelectProps = {
  value: ReasoningEffortSetting
  onChange: (value: ReasoningEffortSetting) => void
  /** 当前模型可用档位；空则只显示 auto */
  availableEfforts?: string[]
  disabled?: boolean
  className?: string
  id?: string
}

const SETTING_OPTIONS: ReasoningEffortSetting[] = ['auto', ...REASONING_EFFORTS]

export const ReasoningEffortSelect: React.FC<ReasoningEffortSelectProps> = ({
  value,
  onChange,
  availableEfforts,
  disabled,
  className,
  id
}) => {
  const { t } = useTranslation()
  const normalized = normalizeReasoningEffortSetting(value)
  const options = SETTING_OPTIONS.filter(
    (opt) => opt === 'auto' || !availableEfforts || availableEfforts.includes(opt)
  )

  return (
    <select
      id={id}
      className={className}
      disabled={disabled}
      value={normalized}
      onChange={(e) => onChange(normalizeReasoningEffortSetting(e.target.value))}
      aria-label={t('agent.reasoning.effort_label', '思考强度')}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {formatReasoningEffortLabel(opt)}
        </option>
      ))}
    </select>
  )
}
