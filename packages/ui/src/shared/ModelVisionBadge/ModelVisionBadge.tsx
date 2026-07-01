import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdVisibility } from 'react-icons/md'
import { isVisionModel } from '@baishou/shared'

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

  return (
    <MdVisibility
      title={t('models.vision_supported', '支持视觉多模态')}
      aria-label={t('models.vision_supported', '支持视觉多模态')}
      className={className}
      style={{
        marginLeft: 6,
        fontSize: size,
        color: 'var(--text-secondary, #666)',
        verticalAlign: 'middle',
        opacity: 0.8,
        flexShrink: 0,
        ...style
      }}
    />
  )
}
