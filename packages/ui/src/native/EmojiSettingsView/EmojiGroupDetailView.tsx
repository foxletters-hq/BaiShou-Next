import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import type { EmojiGroup, EmojiToolConfig } from '@baishou/shared'
import { findEmojiGroup, normalizeEmojiToolConfig, upsertEmojiGroup } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { EmojiGroupStickerGrid } from './EmojiGroupStickerGrid'

export interface EmojiGroupDetailViewProps {
  config: EmojiToolConfig
  groupId: string
  onChange: (config: EmojiToolConfig) => void
  onPickAndImport: () => Promise<
    {
      relativePath: string
      originalName: string
      error: string | null
    }[]
  >
  onResolvePath: (relativePath: string) => Promise<string>
  onDelete: (relativePath: string) => Promise<boolean>
}

export const EmojiGroupDetailView: React.FC<EmojiGroupDetailViewProps> = ({
  config,
  groupId,
  onChange,
  onPickAndImport,
  onResolvePath,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const normalized = useMemo(() => normalizeEmojiToolConfig(config), [config])
  const group = findEmojiGroup(normalized, groupId)

  if (!group) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.textSecondary }}>
          {t('agent.tools.emoji_group_not_found', '表情包组不存在')}
        </Text>
      </View>
    )
  }

  const updateGroup = (nextGroup: EmojiGroup) => {
    onChange(upsertEmojiGroup(normalized, nextGroup))
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.nameCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: tokens.radius.lg
          }
        ]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('agent.tools.emoji_group_name', '组名称')}
        </Text>
        <TextInput
          style={[
            styles.nameInput,
            {
              color: colors.textPrimary,
              borderColor: colors.borderMuted,
              backgroundColor: colors.bgSurfaceNormal
            }
          ]}
          value={group.name}
          onChangeText={(text) => updateGroup({ ...group, name: text })}
          placeholder={t('agent.tools.emoji_group_name_placeholder', '例如：日常、工作')}
          placeholderTextColor={colors.textTertiary}
          maxLength={24}
        />
      </View>

      <EmojiGroupStickerGrid
        group={group}
        onChange={updateGroup}
        onPickAndImport={onPickAndImport}
        onResolvePath={onResolvePath}
        onDelete={onDelete}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  empty: { padding: 24, alignItems: 'center' },
  nameCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8
  },
  label: { fontSize: 13, fontWeight: '600' },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  }
})
