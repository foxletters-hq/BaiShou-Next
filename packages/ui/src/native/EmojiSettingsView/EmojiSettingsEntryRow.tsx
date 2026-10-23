import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface EmojiSettingsEntryRowProps {
  config: EmojiToolConfig
  onPress: () => void
}

export const EmojiSettingsEntryRow: React.FC<EmojiSettingsEntryRowProps> = ({
  config,
  onPress
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const normalized = normalizeEmojiToolConfig(config)
  const groupCount = normalized.groups.length
  const stickerCount = normalized.groups.reduce(
    (sum, group) => sum + (group.emojis?.length ?? 0),
    0
  )

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('agent.tools.emoji_settings', '表情包设置')}
        </Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {normalized.enabled
            ? t('agent.tools.emoji_entry_meta', '{{groups}} 组 · {{stickers}} 个表情', {
                groups: groupCount,
                stickers: stickerCount
              })
            : t('agent.tools.emoji_disabled', '已关闭')}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.smPlus
  },
  info: { flex: 1, gap: sharedTokens.spacing.xxs },
  title: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  meta: { fontSize: mobileTypography.caption.fontSize }
})
