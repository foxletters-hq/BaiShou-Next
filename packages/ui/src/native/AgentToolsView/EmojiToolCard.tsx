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
import { Image as ImageIcon, ImagePlus, Settings, Smile, Trash2, Upload } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { AGENT_TOOL_ICON_SIZE, DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Switch } from '../Switch'
import { Modal } from '../Modal'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface EmojiItem {
  id: string
  name: string
  relativePath: string
}

export interface EmojiToolConfig {
  enabled: boolean
  emojis: EmojiItem[]
}

export interface EmojiToolCardProps {
  config: EmojiToolConfig
  onChange: (config: EmojiToolConfig) => void
  /** Mobile: pick and import emoji images via image picker */
  onPickAndImport: () => Promise<
    {
      relativePath: string
      originalName: string
      error: string | null
    }[]
  >
  /** Resolve a relativePath to a displayable URI */
  onResolvePath: (relativePath: string) => Promise<string>
  /** Delete an emoji file */
  onDelete: (relativePath: string) => Promise<boolean>
}

const DEFAULT_EMOJI_CONFIG: EmojiToolConfig = {
  enabled: false,
  emojis: []
}

export const EmojiToolCard: React.FC<EmojiToolCardProps> = ({
  config,
  onChange,
  onPickAndImport,
  onResolvePath,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const emojiConfig = config || DEFAULT_EMOJI_CONFIG
  const isEnabled = emojiConfig.enabled === true
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [emojiPreviews, setEmojiPreviews] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadEmojiPreviews = useCallback(async () => {
    const emojis = emojiConfig.emojis
    if (!emojis || emojis.length === 0) {
      setEmojiPreviews({})
      return
    }
    try {
      const previews: Record<string, string> = {}
      for (const emoji of emojis) {
        try {
          const uri = await onResolvePath(emoji.relativePath)
          if (uri) previews[emoji.id] = uri
        } catch {
          // Skip missing files
        }
      }
      setEmojiPreviews(previews)
    } catch (e) {
      console.warn('[EmojiToolCard] Failed to load emoji previews:', e)
    }
  }, [emojiConfig.emojis, onResolvePath])

  useEffect(() => {
    loadEmojiPreviews()
  }, [loadEmojiPreviews])

  useEffect(() => {
    if (showSettingsPopup) {
      loadEmojiPreviews()
    }
  }, [showSettingsPopup, loadEmojiPreviews])

  const handleToggle = () => {
    onChange({ ...emojiConfig, enabled: !isEnabled })
  }

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
        const errorMsg =
          errors.length === 1
            ? errors[0]
            : t('agent.tools.emoji_import_partial_error', '{{count}} 个文件导入失败', {
                count: errors.length
              }) +
              '：' +
              errors.join('；')
        Alert.alert(t('agent.tools.emoji_import_error_title', '导入失败'), errorMsg)
      }

      if (newEmojis.length > 0) {
        onChange({
          ...emojiConfig,
          emojis: [...(emojiConfig.emojis || []), ...newEmojis]
        })
      }
    } catch (e) {
      console.error('[EmojiToolCard] Failed to pick emoji:', e)
      Alert.alert(
        t('agent.tools.emoji_import_error_title', '导入失败'),
        t('agent.tools.emoji_import_error', '表情包导入失败')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEmoji = async (emojiId: string) => {
    const emoji = emojiConfig.emojis?.find((e) => e.id === emojiId)
    if (!emoji) return
    onChange({
      ...emojiConfig,
      emojis: emojiConfig.emojis?.filter((e) => e.id !== emojiId) || []
    })
    try {
      await onDelete(emoji.relativePath)
    } catch {
      // Ignore file delete errors
    }
  }

  const handleRenameEmoji = (emojiId: string, newName: string) => {
    onChange({
      ...emojiConfig,
      emojis: emojiConfig.emojis?.map((e) => (e.id === emojiId ? { ...e, name: newName } : e)) || []
    })
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.bgSurface,
          opacity: isEnabled ? 1 : 0.75
        }
      ]}
    >
      {/* 卡片主体 */}
      <View style={styles.cardMain}>
        <View
          style={[
            styles.toolIconWrapper,
            { backgroundColor: isEnabled ? colors.primaryLight : colors.bgSurfaceNormal }
          ]}
        >
          <Smile
            size={AGENT_TOOL_ICON_SIZE}
            color={isEnabled ? colors.primary : colors.textSecondary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
        </View>
        <View style={styles.toolInfo}>
          <View style={styles.toolNameRow}>
            <Text
              style={[
                styles.toolName,
                { color: isEnabled ? colors.textPrimary : colors.textSecondary }
              ]}
            >
              {t('agent.tools.emoji_send', '表情包')}
            </Text>
            <HelpTooltip
              content={t(
                'agent.tools.emoji_send_desc',
                '根据对话情绪自动回复表情包贴图，让对话更生动'
              )}
              size={16}
            />
          </View>
        </View>
        {/* 设置按钮 */}
        <TouchableOpacity
          style={styles.emojiSettingsBtn}
          onPress={() => setShowSettingsPopup(true)}
          accessibilityLabel={t('agent.tools.emoji_settings', '设置')}
        >
          <Settings size={18} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </TouchableOpacity>
        <Switch value={isEnabled} onValueChange={handleToggle} />
      </View>

      {/* 设置弹窗 */}
      <Modal
        visible={showSettingsPopup}
        onClose={() => setShowSettingsPopup(false)}
        title={t('agent.tools.emoji_settings_title', '表情包设置')}
        contentMaxHeight={Math.round(500)}
      >
        <View style={styles.popupContent}>
          {/* 表情包网格管理 */}
          <View style={styles.emojiManageSection}>
            <Text style={[styles.emojiManageLabel, { color: colors.textSecondary }]}>
              {t('agent.tools.emoji_manage_label', '表情包管理')}
            </Text>
            <ScrollView
              style={styles.emojiPopupGrid}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingRight: sharedTokens.spacing.mdTight }}
            >
              <View style={styles.emojiGridInner}>
                {emojiConfig.emojis?.map((emoji) => (
                  <View
                    key={emoji.id}
                    style={[styles.emojiCard, { borderColor: colors.borderMuted }]}
                  >
                    <View
                      style={[styles.emojiCardImage, { backgroundColor: colors.bgSurfaceNormal }]}
                    >
                      {emojiPreviews[emoji.id] ? (
                        <Image
                          source={{ uri: emojiPreviews[emoji.id] }}
                          style={styles.emojiImg}
                          resizeMode="contain"
                        />
                      ) : (
                        <ImageIcon
                          size={24}
                          color={colors.textTertiary}
                          strokeWidth={DEFAULT_STROKE_WIDTH}
                        />
                      )}
                    </View>
                    <View style={styles.emojiCardFooter}>
                      <TextInput
                        style={[
                          styles.emojiNameInput,
                          { color: colors.textPrimary, borderColor: colors.borderMuted }
                        ]}
                        value={emoji.name}
                        onChangeText={(text) => handleRenameEmoji(emoji.id, text)}
                        placeholder={t('agent.tools.emoji_name_placeholder', '名称')}
                        placeholderTextColor={colors.textTertiary}
                        maxLength={20}
                      />
                      <TouchableOpacity
                        style={styles.emojiDeleteBtn}
                        onPress={() => handleDeleteEmoji(emoji.id)}
                        accessibilityLabel={t('agent.tools.emoji_delete', '删除')}
                      >
                        <Trash2
                          size={16}
                          color={colors.textSecondary}
                          strokeWidth={DEFAULT_STROKE_WIDTH}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {!emojiConfig.emojis || emojiConfig.emojis.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emojiEmptyHint}
                    onPress={handlePickAndImport}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.textTertiary} />
                    ) : (
                      <ImagePlus
                        size={32}
                        color={colors.textTertiary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    )}
                    <Text style={[styles.emojiEmptyText, { color: colors.textTertiary }]}>
                      {isLoading
                        ? t('agent.tools.emoji_importing', '导入中...')
                        : t('agent.tools.emoji_empty_hint', '还没有表情包，点击添加')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.emojiAddCard,
                      { borderColor: colors.borderMuted, backgroundColor: colors.bgSurfaceNormal }
                    ]}
                    onPress={handlePickAndImport}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Upload
                        size={24}
                        color={colors.textSecondary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    )}
                    <Text style={[styles.emojiAddText, { color: colors.textSecondary }]}>
                      {isLoading
                        ? t('agent.tools.emoji_importing', '导入中...')
                        : t('agent.tools.emoji_add', '添加')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>

          <Text style={[styles.emojiPopupAuthor, { color: colors.textTertiary }]}>
            Developer:Ratman463
          </Text>
        </View>
      </Modal>
    </View>
  )
}

const CARD_SIZE = 90

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.control,
    overflow: 'hidden'
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  toolIconWrapper: {
    padding: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  toolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  toolName: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  emojiSettingsBtn: {
    padding: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.xsPlus
  },
  popupContent: {
    gap: sharedTokens.spacing.mdTight
  },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight
  },
  emojiManageSection: {
    gap: sharedTokens.spacing.sm
  },
  emojiManageLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  emojiPopupGrid: {
    maxHeight: 260
  },
  emojiGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  emojiCard: {
    width: CARD_SIZE,
    height: CARD_SIZE + 26,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.sm,
    overflow: 'hidden'
  },
  emojiCardImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emojiImg: {
    width: CARD_SIZE - 8,
    height: CARD_SIZE - 8,
    borderRadius: sharedTokens.radius.xs
  },
  emojiCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.xxs,
    flexShrink: 0
  },
  emojiNameInput: {
    flex: 1,
    fontSize: mobileTypography.caption.fontSize,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.xs,
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xxs,
    includeFontPadding: false
  },
  emojiDeleteBtn: {
    padding: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  emojiAddCard: {
    width: CARD_SIZE,
    height: CARD_SIZE + 26,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.xs
  },
  emojiAddText: {
    fontSize: mobileTypography.caption.fontSize
  },
  emojiEmptyHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.xs,
    width: CARD_SIZE,
    height: CARD_SIZE + 26
  },
  emojiEmptyText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  emojiPopupAuthor: {
    fontSize: mobileTypography.caption.fontSize,
    textAlign: 'center',
    marginTop: sharedTokens.spacing.xs
  }
})
