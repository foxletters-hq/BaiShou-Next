import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight, Smile } from 'lucide-react-native'
import type { EmojiToolConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

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
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.borderStrong }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
        <Smile size={20} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
      </View>
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13 }
})
