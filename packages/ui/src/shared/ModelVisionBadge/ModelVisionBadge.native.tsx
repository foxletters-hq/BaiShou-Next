import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { ModelVisionBadgeProps } from './ModelVisionBadge'
import { useIsVisionModel } from './useIsVisionModel'

export function ModelVisionBadge({
  modelId,
  providerKey,
  size = 14,
  style
}: ModelVisionBadgeProps) {
  const { t } = useTranslation()
  const supported = useIsVisionModel(modelId, providerKey)

  if (!supported) {
    return null
  }

  return (
    <Eye
      size={size}
      strokeWidth={DEFAULT_STROKE_WIDTH}
      accessibilityLabel={t('models.vision_supported', '支持视觉多模态')}
      style={[{ marginLeft: 4, opacity: 0.75 }, style]}
    />
  )
}
