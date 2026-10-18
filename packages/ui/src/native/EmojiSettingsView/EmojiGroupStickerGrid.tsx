import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import type { EmojiGroup, EmojiItem } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface EmojiGroupStickerGridProps {
  group: EmojiGroup
  onChange: (group: EmojiGroup) => void
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

export const EmojiGroupStickerGrid: React.FC<EmojiGroupStickerGridProps> = ({
  group,
  onChange,
  onPickAndImport,
  onResolvePath,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [emojiPreviews, setEmojiPreviews] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadEmojiPreviews = useCallback(async () => {
    const emojis = group.emojis
    if (!emojis || emojis.length === 0) {
      setEmojiPreviews({})
      return
    }
    const previews: Record<string, string> = {}
    for (const emoji of emojis) {
      try {
        const uri = await onResolvePath(emoji.relativePath)
        if (uri) previews[emoji.id] = uri
      } catch {
        // skip missing
      }
    }
    setEmojiPreviews(previews)
  }, [group.emojis, onResolvePath])

  useEffect(() => {
    void loadEmojiPreviews()
  }, [loadEmojiPreviews])

  const handlePickAndImport = async () => {
    try {
      setIsLoading(true)
      const results = await onPickAndImport()
      if (!results || results.length === 0) return

      const newEmojis: EmojiItem[] = []
      const errors: string[] = []

      for (const result of results) {
        if (result.error) {
          errors.push(result.error)
        } else if (result.relativePath) {
          const name =
            result.originalName ||
            result.relativePath
              .split('/')
              .pop()
              ?.replace(/\.[^.]+$/, '') ||
            ''
          newEmojis.push({
            id: result.relativePath.split('/').pop() || result.relativePath,
            name: name.replace(/^emoji_/, ''),
            relativePath: result.relativePath
          })
        }
      }

      if (errors.length > 0) {
        Alert.alert(t('agent.tools.emoji_import_error_title', '导入失败'), errors.join('；'))
      }

      if (newEmojis.length > 0) {
        onChange({
          ...group,
          emojis: [...(group.emojis || []), ...newEmojis]
        })
      }
    } catch {
      Alert.alert(
        t('agent.tools.emoji_import_error_title', '导入失败'),
        t('agent.tools.emoji_import_error', '表情包导入失败')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEmoji = async (emojiId: string) => {
    const emoji = group.emojis?.find((item) => item.id === emojiId)
    if (!emoji) return
    onChange({
      ...group,
      emojis: group.emojis?.filter((item) => item.id !== emojiId) || []
    })
    try {
      await onDelete(emoji.relativePath)
    } catch {
      // ignore
    }
  }

  const handleRenameEmoji = (emojiId: string, newName: string) => {
    onChange({
      ...group,
      emojis:
        group.emojis?.map((item) => (item.id === emojiId ? { ...item, name: newName } : item)) || []
    })
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.addBtn,
          {
            borderColor: colors.borderMuted,
            backgroundColor: colors.bgSurfaceNormal
          }
        ]}
        onPress={() => void handlePickAndImport()}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Plus size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>
              {t('agent.tools.emoji_add', '添加表情包')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.grid} nestedScrollEnabled>
        {group.emojis?.map((emoji) => (
          <View
            key={emoji.id}
            style={[
              styles.card,
              { borderColor: colors.borderMuted, backgroundColor: colors.bgSurface }
            ]}
          >
            <View style={[styles.imageBox, { backgroundColor: colors.bgSurfaceNormal }]}>
              {emojiPreviews[emoji.id] ? (
                <Image
                  source={{ uri: emojiPreviews[emoji.id] }}
                  style={styles.image}
                  resizeMode="contain"
                />
              ) : (
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: mobileTypography.caption.fontSize
                  }}
                >
                  ?
                </Text>
              )}
            </View>
            <TextInput
              style={[
                styles.nameInput,
                { color: colors.textPrimary, borderColor: colors.borderMuted }
              ]}
              value={emoji.name}
              onChangeText={(text) => handleRenameEmoji(emoji.id, text)}
              placeholder={t('agent.tools.emoji_name_placeholder', '名称')}
              placeholderTextColor={colors.textTertiary}
              maxLength={20}
            />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => void handleDeleteEmoji(emoji.id)}
              accessibilityLabel={t('common.delete')}
            >
              <Trash2 size={16} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: sharedTokens.spacing.mdTight },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    borderStyle: 'dashed',
    paddingVertical: sharedTokens.spacing.mdSnug
  },
  addBtnText: { fontSize: mobileTypography.body.fontSize, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.sm
  },
  card: {
    width: '30%',
    minWidth: 96,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.xsPlus
  },
  imageBox: {
    aspectRatio: 1,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  image: { width: '100%', height: '100%' },
  nameInput: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.sm,
    fontSize: mobileTypography.caption.fontSize,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  deleteBtn: {
    alignSelf: 'flex-end',
    padding: sharedTokens.spacing.xxs
  }
})
