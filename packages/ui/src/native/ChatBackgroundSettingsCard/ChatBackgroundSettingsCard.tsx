import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon } from 'lucide-react-native'
import {
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  chatBackgroundOverlayTransparencyFromOpacity,
  chatBackgroundOverlayOpacityFromTransparency,
  chatBackgroundOverlayAlpha
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH, NAV_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { SettingsSliderRow } from '../settings/SettingsSliderRow'

/** 设置页预览区固定 3:4，与默认裁剪比例一致 */
const PREVIEW_ASPECT_RATIO = 3 / 4

export interface ChatBackgroundSettingsProps {
  backgroundPath?: string | null
  resolvedBackgroundUri?: string | null
  blur?: number
  overlayOpacity?: number
  onPickBackground: () => void
  onClearBackground: () => void
  onBlurChange?: (value: number) => void
  onOverlayOpacityChange?: (value: number) => void
  embedded?: boolean
  isLast?: boolean
}

export const ChatBackgroundSettingsCard: React.FC<ChatBackgroundSettingsProps> = ({
  backgroundPath,
  resolvedBackgroundUri,
  blur = 0,
  overlayOpacity = 0,
  onPickBackground,
  onClearBackground,
  onBlurChange,
  onOverlayOpacityChange,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const committedBlur = normalizeChatBackgroundBlur(blur)
  const committedOverlayOpacity = normalizeChatBackgroundOverlayOpacity(overlayOpacity)
  const committedOverlayTransparency =
    chatBackgroundOverlayTransparencyFromOpacity(committedOverlayOpacity)
  const [previewBlur, setPreviewBlur] = useState(committedBlur)
  const [previewOverlayTransparency, setPreviewOverlayTransparency] = useState(
    committedOverlayTransparency
  )

  useEffect(() => {
    setPreviewBlur(committedBlur)
  }, [committedBlur])

  useEffect(() => {
    setPreviewOverlayTransparency(committedOverlayTransparency)
  }, [committedOverlayTransparency])

  const previewOverlayAlpha = chatBackgroundOverlayAlpha(
    chatBackgroundOverlayOpacityFromTransparency(previewOverlayTransparency)
  )

  const subtitle = backgroundPath
    ? t('settings.chat_background_custom', '自定义背景')
    : t('settings.chat_background_default', '未设置')

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      icon={
        <ImageIcon
          size={NAV_ICON_SIZE}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          color={colors.textSecondary}
        />
      }
      title={t('settings.chat_background', '聊天背景')}
      subtitle={subtitle}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPickBackground}
        style={[
          styles.previewArea,
          {
            aspectRatio: PREVIEW_ASPECT_RATIO,
            borderColor: colors.borderMuted
          }
        ]}
      >
        {resolvedBackgroundUri ? (
          <View style={styles.previewImageWrap}>
            <Image
              source={{ uri: resolvedBackgroundUri }}
              style={styles.previewImg}
              resizeMode="cover"
              blurRadius={previewBlur}
            />
            {previewOverlayAlpha > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.previewScrim,
                  { backgroundColor: `rgba(0, 0, 0, ${previewOverlayAlpha})` }
                ]}
              />
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.previewPlaceholder,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
            ]}
          >
            <ImageIcon size={32} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.previewPlaceholderText, { color: colors.textSecondary }]}>
              {t('settings.chat_background_pick_hint', '点击选择背景')}
            </Text>
          </View>
        )}
        <View style={[styles.previewOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
          <Text style={[styles.previewOverlayText, { color: colors.textOnPrimary }]}>
            {t('settings.chat_background_change', '更换背景')}
          </Text>
        </View>
      </TouchableOpacity>

      {backgroundPath ? (
        <>
          <View style={styles.sliderBlock}>
            <SettingsSliderRow
              title={t('settings.chat_background_blur', '背景模糊')}
              value={committedBlur}
              min={CHAT_BACKGROUND_BLUR_MIN}
              max={CHAT_BACKGROUND_BLUR_MAX}
              step={1}
              onChange={(value) => onBlurChange?.(value)}
              onPreviewChange={setPreviewBlur}
              formatValue={(value) => `${value}px`}
            />
            <SettingsSliderRow
              title={t('settings.chat_background_overlay', '遮罩透明度')}
              value={committedOverlayTransparency}
              min={CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN}
              max={CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX}
              step={1}
              onChange={(value) =>
                onOverlayOpacityChange?.(chatBackgroundOverlayOpacityFromTransparency(value))
              }
              onPreviewChange={setPreviewOverlayTransparency}
              formatValue={(value) => `${value}%`}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={onClearBackground}
            style={[styles.resetBtn, { borderColor: colors.borderMuted }]}
          >
            <Text style={[styles.resetBtnText, { color: colors.error }]}>
              {t('settings.chat_background_reset', '清除背景')}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  previewArea: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1
  },
  previewImageWrap: {
    width: '100%',
    height: '100%'
  },
  previewImg: {
    width: '100%',
    height: '100%'
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8
  },
  previewPlaceholderText: {
    fontSize: 14,
    fontWeight: '500'
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewOverlayText: {
    fontSize: 15,
    fontWeight: '600'
  },
  sliderBlock: {
    marginTop: 16,
    gap: 4
  },
  resetBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '500'
  }
})
