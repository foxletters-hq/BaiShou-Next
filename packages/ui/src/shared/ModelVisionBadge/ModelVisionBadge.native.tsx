import React from 'react'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { isVisionModel } from '@baishou/shared'
import type { ModelVisionBadgeProps } from './ModelVisionBadge'

export function ModelVisionBadge({
  modelId,
  providerKey,
  size = 14,
  style
}: ModelVisionBadgeProps) {
  const { t } = useTranslation()

  if (!isVisionModel(modelId, providerKey)) {
    return null
  }

  return (
    <MaterialIcons
      name="visibility"
      size={size}
      accessibilityLabel={t('models.vision_supported', '支持视觉多模态')}
      style={[{ marginLeft: 4, opacity: 0.75 }, style]}
    />
  )
}
