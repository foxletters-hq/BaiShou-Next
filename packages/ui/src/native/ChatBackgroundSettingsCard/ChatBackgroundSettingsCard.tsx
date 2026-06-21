import React from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

/** 默认聊天背景图 */
const DEFAULT_CHAT_BG: ImageSourcePropType = require('@baishou/shared/assets/images/BaiShou-v0.0.1.jpeg')

export interface ChatBackgroundSettingsProps {
  backgroundPath?: string | null
  resolvedBackgroundUri?: string | null
  onPickBackground: () => void
  onClearBackground: () => void
  embedded?: boolean
  isLast?: boolean
}

export const ChatBackgroundSettingsCard: React.FC<ChatBackgroundSettingsProps> = ({
  backgroundPath,
  resolvedBackgroundUri,
  onPickBackground,
  onClearBackground,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const subtitle = backgroundPath
    ? t('settings.chat_background_custom', '自定义背景')
    : t('settings.chat_background_default', '默认背景')

  const previewSource = resolvedBackgroundUri
    ? { uri: resolvedBackgroundUri }
    : DEFAULT_CHAT_BG

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.chat_background', '聊天背景')}
      subtitle={subtitle}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPickBackground}
        style={styles.previewArea}
      >
        <Image
          source={previewSource}
          style={styles.previewImg}
          resizeMode="cover"
        />
        <View style={[styles.previewOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
          <Text style={styles.previewOverlayText}>
            {t('settings.chat_background_change', '更换背景')}
          </Text>
        </View>
      </TouchableOpacity>

      {backgroundPath ? (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={onClearBackground}
          style={[styles.resetBtn, { borderColor: colors.borderMuted }]}
        >
          <Text style={[styles.resetBtnText, { color: colors.error }]}>
            {t('settings.chat_background_reset', '恢复默认背景')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  previewArea: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative'
  },
  previewImg: {
    width: '100%',
    height: '100%'
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewOverlayText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
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