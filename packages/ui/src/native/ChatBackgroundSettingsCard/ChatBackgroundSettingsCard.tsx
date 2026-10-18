import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native'
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
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsListLeadingIcon } from '../settings/SettingsListLeadingIcon'
import { SettingsSliderRow } from '../settings/SettingsSliderRow'
import { Modal, modalActionsStyle } from '../Modal/Modal'
import { Button } from '../Button'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  const { colors, tokens } = useNativeTheme()
  const [modalOpen, setModalOpen] = useState(false)

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

  const rowContent = (
    <TouchableOpacity
      onPress={() => setModalOpen(true)}
      activeOpacity={0.65}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={[
        hubStyles.row,
        embedded && !isLast && [hubStyles.rowDivider, { borderBottomColor: colors.borderSubtle }],
        !embedded && {
          paddingHorizontal: sharedTokens.spacing.mdSnug,
          paddingVertical: sharedTokens.spacing.mdSnug
        }
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('settings.chat_background', '聊天背景')}
    >
      <SettingsListLeadingIcon>
        <ImageIcon
          size={NAV_ICON_SIZE}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          color={colors.textSecondary}
        />
      </SettingsListLeadingIcon>
      <View style={{ flex: 1 }}>
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
          {t('settings.chat_background', '聊天背景')}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              color: colors.textSecondary,
              marginTop: sharedTokens.spacing.xxs,
              fontWeight: '400'
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[hubStyles.hubChevron, { color: colors.textTertiary }]}>›</Text>
    </TouchableOpacity>
  )

  const modalContent = (
    <Modal
      visible={modalOpen}
      title={t('settings.chat_background', '聊天背景')}
      onClose={() => setModalOpen(false)}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.modalBody}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPickBackground}
          style={[
            styles.previewArea,
            {
              borderColor: colors.borderMuted,
              backgroundColor: colors.bgApp
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
              <View style={[styles.previewOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
                <ImageIcon
                  size={20}
                  color={colors.textOnPrimary}
                  strokeWidth={DEFAULT_STROKE_WIDTH}
                  style={styles.previewOverlayIcon}
                />
                <Text style={[styles.previewOverlayText, { color: colors.textOnPrimary }]}>
                  {t('settings.chat_background_change', '更换背景')}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.previewPlaceholder,
                { backgroundColor: colors.bgApp, borderColor: colors.borderMuted }
              ]}
            >
              <ImageIcon
                size={36}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
              <Text style={[styles.previewPlaceholderText, { color: colors.textSecondary }]}>
                {t('settings.chat_background_pick_hint', '点击选择背景')}
              </Text>
            </View>
          )}
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
              style={[styles.resetBtn, { borderColor: colors.borderControl }]}
            >
              <Text style={[styles.resetBtnText, { color: colors.error }]}>
                {t('settings.chat_background_reset', '清除背景')}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={modalActionsStyle}>
          {backgroundPath ? (
            <>
              <Button variant="outlined" size="sm" onPress={onPickBackground}>
                {t('settings.chat_background_change', '更换背景')}
              </Button>
              <Button size="sm" onPress={() => setModalOpen(false)}>
                {t('common.done', '完成')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outlined" size="sm" onPress={() => setModalOpen(false)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button size="sm" onPress={onPickBackground}>
                {t('settings.chat_background_change', '选择背景')}
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  )

  if (embedded) {
    return (
      <View>
        {rowContent}
        {modalContent}
      </View>
    )
  }

  return (
    <View
      style={{
        marginBottom: sharedTokens.spacing.mdTight,
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      {rowContent}
      {modalContent}
    </View>
  )
}

const styles = StyleSheet.create({
  modalBody: {
    paddingBottom: sharedTokens.spacing.xs
  },
  previewArea: {
    width: 180,
    aspectRatio: PREVIEW_ASPECT_RATIO,
    alignSelf: 'center',
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm
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
    gap: sharedTokens.spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: sharedTokens.radius.md
  },
  previewPlaceholderText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  previewOverlayIcon: {
    marginBottom: sharedTokens.spacing.xxs
  },
  previewOverlayText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  sliderBlock: {
    marginTop: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.xs
  },
  resetBtn: {
    marginTop: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center'
  },
  resetBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  }
})
