import React, { useState, useCallback } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { MaterialIcons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import type { MockChatAttachment } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import { useNativeToast } from '../Toast'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const TOOLBAR_ANIM_MS = 200

export interface InputBarProps {
  isLoading: boolean
  onSend: (text: string, attachments?: MockChatAttachment[]) => void
  onStop?: () => void
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  onTriggerShortcut?: () => void
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'off' | 'always' | 'manual'
  onToggleTtsMode?: () => void
}

export const InputBar: React.FC<InputBarProps> = ({
  onSend,
  isLoading,
  onStop,
  assistantName = 'Assistant',
  onAssistantTap,
  onRecall,
  onTriggerShortcut,
  onManageShortcuts,
  onOpenTools,
  searchMode = false,
  onToggleSearchMode,
  ttsMode = 'manual',
  onToggleTtsMode
}) => {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { colors } = useNativeTheme()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [showToolbar, setShowToolbar] = useState(true)
  const toolbarProgress = useSharedValue(1)

  const toggleToolbar = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: TOOLBAR_ANIM_MS,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity
      }
    })
    setShowToolbar((prev) => {
      const next = !prev
      toolbarProgress.value = withTiming(next ? 1 : 0, { duration: TOOLBAR_ANIM_MS })
      return next
    })
  }, [toolbarProgress])

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarProgress.value,
    maxHeight: toolbarProgress.value * 44,
    marginBottom: toolbarProgress.value * 8,
    overflow: 'hidden' as const
  }))

  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: '*/*'
      })

      if (!result.canceled && result.assets) {
        const newAtts = result.assets
          .map((asset) => {
            const isImage =
              /\.(png|jpe?g|gif|webp|bmp)$/i.test(asset.name) ||
              (asset.mimeType?.startsWith('image/') ?? false)
            const isPdf = /\.pdf$/i.test(asset.name) || asset.mimeType === 'application/pdf'
            const isText =
              /\.(txt|md)$/i.test(asset.name) || (asset.mimeType?.startsWith('text/') ?? false)
            return {
              id: Math.random().toString(36).substring(7),
              fileName: asset.name,
              filePath: asset.uri,
              isImage,
              isPdf,
              isText,
              fileSize: asset.size
            }
          })
          .filter((att) => {
            if (att.isText && att.fileSize && att.fileSize > 512 * 1024) {
              toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
              return false
            }
            return true
          })
        if (newAtts.length > 0) {
          setAttachments((prev) => [...prev, ...newAtts])
        }
      }
    } catch (err) {
      console.warn('Document picker error:', err)
    }
  }

  const handleSend = () => {
    if ((text.trim() || attachments.length > 0) && !isLoading) {
      onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined)
      setText('')
      setAttachments([])
    }
  }

  const handleShortcutPress = () => {
    if (onTriggerShortcut) {
      onTriggerShortcut()
      return
    }
    onManageShortcuts?.()
  }

  const renderToolbarChip = (
    label: string,
    onPress?: () => void,
    options?: { active?: boolean; icon?: keyof typeof MaterialIcons.glyphMap }
  ) => {
    if (!onPress) return null
    const active = options?.active ?? false
    return (
      <TouchableOpacity
        key={label}
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.primary : colors.bgSurfaceHigh,
            borderColor: colors.borderMuted
          }
        ]}
        onPress={onPress}
      >
        {options?.icon ? (
          <MaterialIcons
            name={options.icon}
            size={14}
            color={active ? colors.textOnPrimary : colors.textSecondary}
          />
        ) : null}
        <Text
          style={[
            styles.chipLabel,
            { color: active ? colors.textOnPrimary : colors.textSecondary }
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderMuted
        }
      ]}
    >
      {attachments.length > 0 && (
        <ScrollView horizontal style={styles.attachmentList} showsHorizontalScrollIndicator={false}>
          {attachments.map((att) => (
            <View
              key={att.id}
              style={[
                styles.attachmentChip,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.bgSurfaceHigh
                }
              ]}
            >
              {att.isImage ? (
                <Image source={{ uri: att.filePath }} style={styles.attImage} />
              ) : (
                <View style={styles.attDoc}>
                  <Text style={styles.attDocIcon}>{att.isPdf || att.isText ? '📄' : '📁'}</Text>
                  <Text
                    style={[styles.attDocName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {att.fileName}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.attRemoveBtn, { backgroundColor: colors.bgOverlay }]}
                onPress={() => setAttachments((prev) => prev.filter((p) => p.id !== att.id))}
              >
                <Text style={[styles.attRemoveLabel, { color: colors.textOnPrimary }]}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Animated.View style={toolbarAnimatedStyle}>
        {showToolbar && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}
          >
            {renderToolbarChip(t('input.upload_attachment', '上传附件'), handlePickFiles, {
              icon: 'attach-file'
            })}
            {renderToolbarChip(t('input.shortcut_command', '快捷指令'), handleShortcutPress, {
              icon: 'bolt'
            })}
            {renderToolbarChip(
              searchMode
                ? t('settings.web_search_mode_tool', '外部工具搜索')
                : t('settings.web_search_mode_off', '关闭搜索'),
              onToggleSearchMode,
              { active: searchMode, icon: 'public' }
            )}
            {renderToolbarChip(t('settings.recall_memories', '唤醒回忆'), onRecall, {
              icon: 'menu-book'
            })}
            {renderToolbarChip(
              ttsMode === 'always'
                ? t('agent.chat.tts_always', '始终朗读')
                : ttsMode === 'off'
                  ? t('agent.chat.tts_off', '语音关闭')
                  : t('agent.chat.tts_manual', '手动朗读'),
              onToggleTtsMode,
              { active: ttsMode === 'always', icon: 'volume-up' }
            )}
            {renderToolbarChip(t('settings.agent_tools_title', '工具管理'), onOpenTools, {
              icon: 'build'
            })}
          </ScrollView>
        )}
      </Animated.View>

      <View style={[styles.inputWrapper, { backgroundColor: colors.bgSurfaceHigh }]}>
        <TouchableOpacity
          style={styles.toolbarToggle}
          onPress={toggleToolbar}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <MaterialIcons
            name={showToolbar ? 'expand-less' : 'add'}
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={text}
          onChangeText={setText}
          placeholder={t('agent.chat.input_hint', '输入消息...')}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={4000}
        />
        {isLoading ? (
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: colors.textPrimary }]}
            onPress={onStop}
            accessibilityLabel={t('common.stop', '停止')}
          >
            <View style={[styles.stopIcon, { backgroundColor: colors.bgSurface }]} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              !text.trim() && attachments.length === 0 && { backgroundColor: colors.textTertiary }
            ]}
            onPress={handleSend}
            disabled={!text.trim() && attachments.length === 0}
            accessibilityLabel={t('common.send', '发送')}
          >
            <MaterialIcons name="arrow-upward" size={18} color={colors.textOnPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderTopWidth: 1
  },
  toolbarContent: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  chipIcon: {
    fontSize: 13
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  toolbarToggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginBottom: 1
  },
  input: {
    flex: 1,
    minHeight: 24,
    maxHeight: 120,
    fontSize: 15,
    paddingTop: 4,
    paddingBottom: 4
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2
  },
  attachmentList: {
    flexDirection: 'row',
    marginBottom: 10,
    maxHeight: 64
  },
  attachmentChip: {
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    width: 64,
    height: 64,
    overflow: 'hidden',
    position: 'relative'
  },
  attImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  attDoc: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attDocIcon: {
    fontSize: 20,
    marginBottom: 2
  },
  attDocName: {
    fontSize: 9,
    textAlign: 'center'
  },
  attRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attRemoveLabel: {
    fontSize: 10,
    fontWeight: 'bold'
  }
})
