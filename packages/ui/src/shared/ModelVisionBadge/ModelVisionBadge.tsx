import React from 'react'
import { useTranslation } from 'react-i18next'
import { isVisionModel } from '@baishou/shared'
import { Eye } from 'lucide-react'

export interface ModelVisionBadgeProps {
  modelId: string
  providerKey?: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

/** 视觉 / 多模态模型标识（小眼睛） */
export function ModelVisionBadge({
  modelId,
  providerKey,
  size = 13,
  className,
  style
}: ModelVisionBadgeProps) {
  const { t } = useTranslation()

  if (!isVisionModel(modelId, providerKey)) {
    return null
  }

  const label = t('models.vision_supported', '支持视觉多模态')

  return (
    <span title={label} style={{ display: 'inline-flex', marginLeft: 6, flexShrink: 0 }}>
      <Eye
        aria-label={label}
        size={size}
        className={className}
        style={{
          color: 'var(--text-secondary, #666)',
          verticalAlign: 'middle',
          opacity: 0.8,
          ...style
        }}
      />
    </span>
  )
}
