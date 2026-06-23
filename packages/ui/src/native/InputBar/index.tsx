import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
  useMemo
} from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  LayoutAnimation,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { MaterialIcons } from '@expo/vector-icons'
import type { MockChatAttachment, PromptShortcut } from '@baishou/shared'
import { getDefaultShortcutLabelsFromT, localizePromptShortcuts } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import { Input } from '../Input/Input'
import { useNativeToast } from '../Toast'
import { useDialog } from '../Dialog'
import { useInputBarShortcuts } from '../../hooks/useInputBarShortcuts'
import { InlinePromptShortcutList } from './InlinePromptShortcutList'
import {
  pickAttachmentsFromCamera,
  pickAttachmentsFromFileManager,
  pickAttachmentsFromPhotoLibrary,
  type PickAttachmentsResult
} from './attachment-picker.util'
import {
  useComposerDraft,
  type ComposerDraftStorage,
  type ComposerOnSend
} from '../../shared/composer-draft'

const TOOLBAR_ANIM_MS = 200

export interface InputBarProps {
  isLoading: boolean
  /** 返回 false 时保留输入内容与草稿 */
  onSend: ComposerOnSend
  onStop?: () => void
  /** 为 true 时不发送并触发 onComposerBlocked */
  composerBlocked?: boolean
  onComposerBlocked?: () => void
  /** 传入后自动持久化/恢复未发送草稿（按会话隔离） */
  composerDraftKey?: string
  composerDraftStorage?: ComposerDraftStorage
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  shortcuts?: PromptShortcut[]
  onTriggerShortcut?: () => void
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'always' | 'manual'
  onToggleTtsMode?: () => void
  /** 输入框获得焦点时回调（用于键盘预抬，避免闪动） */
  onInputFocus?: () => void
  /** 为 false 时禁用底部主输入框（气泡内联编辑时避免双键盘/抢焦点） */
  composerEnabled?: boolean
}

export interface InputBarRef {
  insertText: (text: string) => void
  insertShortcutContent: (content: string) => void
  focus: () => void
  blur: () => void
}

export const InputBar = forwardRef<InputBarRef, InputBarProps>(
  (
    {
      onSend,
      isLoading,
      onStop,
      assistantName = 'Assistant',
      onAssistantTap,
      onRecall,
      shortcuts,
      onTriggerShortcut,
      onManageShortcuts,
      onOpenTools,
      searchMode = false,
      onToggleSearchMode,
      ttsMode = 'manual',
      onToggleTtsMode,
      onInputFocus,
      composerEnabled = true,
      composerBlocked = false,
      onComposerBlocked,
      composerDraftKey,
      composerDraftStorage
    },
    ref
  ) => {
    const { t, i18n } = useTranslation()
    const dialog = useDialog()
    const toast = useNativeToast()
    const { colors, isDark } = useNativeTheme()
    const inputRef = useRef<any>(null)
    const [text, setText] = useState('')
    const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
    const [isSending, setIsSending] = useState(false)
    const { clearDraft } = useComposerDraft({
      draftKey: composerDraftKey,
      draftStorage: composerDraftStorage,
      text,
      setText,
      draftSyncSuspended: isSending
    })
    const [showToolbar, setShowToolbar] = useState(true)
    const toolbarProgress = useSharedValue(1)
    const localizedShortcuts = useMemo(() => {
      if (!shortcuts?.length) return undefined
      return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
    }, [shortcuts, t, i18n.language])
    const shortcutHandlers = useInputBarShortcuts(text, setText, localizedShortcuts)

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
      maxHeight: toolbarProgress.value * 48,
      marginBottom: toolbarProgress.value * 10,
      overflow: 'hidden' as const
    }))

    const applyPickResult = useCallback(
      (result: PickAttachmentsResult) => {
        if (!result.ok) {
          if (result.reason === 'permission_denied') {
            toast.showError(t('input.attachment_permission_denied', '需要相机或相册权限才能继续'))
          } else if (result.reason === 'text_too_large') {
            toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
          }
          return
        }
        setAttachments((prev) => [...prev, ...result.attachments])
      },
      [t, toast]
    )

    const handleUploadAttachment = useCallback(async () => {
      const iconColor = colors.textSecondary
      const choice = await dialog.choose(
        undefined,
        [
          {
            label: t('input.attachment_camera', '拍照'),
            value: 'camera',
            centered: true,
            leading: <MaterialIcons name="photo-camera" size={22} color={iconColor} />
          },
          {
            label: t('input.attachment_photo_library', '相册'),
            value: 'album',
            centered: true,
            leading: <MaterialIcons name="photo-library" size={22} color={iconColor} />
          },
          {
            label: t('input.attachment_file_manager', '文件管理'),
            value: 'files',
            centered: true,
            leading: <MaterialIcons name="folder-open" size={22} color={iconColor} />
          }
        ],
        t('input.attachment_source_title', '选择附件来源')
      )
      if (!choice) return

      try {
        let result: PickAttachmentsResult
        if (choice === 'camera') {
          result = await pickAttachmentsFromCamera()
        } else if (choice === 'album') {
          result = await pickAttachmentsFromPhotoLibrary()
        } else {
          result = await pickAttachmentsFromFileManager()
        }
        applyPickResult(result)
      } catch (err) {
        console.warn('Attachment picker error:', err)
      }
    }, [applyPickResult, colors.textSecondary, dialog, t])

    useImperativeHandle(ref, () => ({
      insertText: (newText: string) => {
        setText((prev) => (prev ? `${prev}\n${newText}` : newText))
        setTimeout(() => inputRef.current?.focus?.(), 0)
      },
      insertShortcutContent: (content: string) => {
        shortcutHandlers.insertShortcutContent(content)
        setTimeout(() => inputRef.current?.focus?.(), 0)
      },
      focus: () => {
        inputRef.current?.focus?.()
      },
      blur: () => {
        inputRef.current?.blur?.()
      }
    }))

    const handleSend = useCallback(async () => {
      if (shortcutHandlers.shortcutModeActive && text.startsWith('/')) return
      if (!text.trim() && attachments.length === 0) return
      if (isLoading || isSending) return

      if (composerBlocked) {
        onComposerBlocked?.()
        return
      }

      setIsSending(true)
      try {
        const accepted = await Promise.resolve(
          onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined)
        )
        if (accepted !== false) {
          setText('')
          setAttachments([])
          await clearDraft()
        }
      } finally {
        setIsSending(false)
      }
    }, [
      attachments,
      clearDraft,
      composerBlocked,
      isLoading,
      isSending,
      onComposerBlocked,
      onSend,
      shortcutHandlers.shortcutModeActive,
      text
    ])

    const handleShortcutPress = () => {
      onManageShortcuts?.()
    }

    const handleChangeText = useCallback(
      (nextText: string) => {
        if (shortcuts?.length) {
          shortcutHandlers.handleTextChangeForShortcuts(text, nextText)
        } else if (nextText === '/' && text === '' && onTriggerShortcut) {
          onTriggerShortcut()
        }
        setText(nextText)
      },
      [shortcuts, shortcutHandlers, text, onTriggerShortcut]
    )

    const handleKeyPress = useCallback(
      (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (shortcutHandlers.tryHandleShortcutKey(event.nativeEvent.key)) {
          event.preventDefault?.()
        }
      },
      [shortcutHandlers]
    )

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
            borderTopColor: colors.borderSubtle
          }
        ]}
      >
        {attachments.length > 0 && (
          <ScrollView
            horizontal
            style={styles.attachmentList}
            showsHorizontalScrollIndicator={false}
          >
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

        <View style={styles.composerBlock}>
          <InlinePromptShortcutList
            visible={shortcutHandlers.shortcutModeActive}
            shortcuts={shortcutHandlers.filteredShortcuts}
            selectedIndex={shortcutHandlers.selectedIndex}
            onSelect={shortcutHandlers.applyShortcut}
          />

          <Animated.View style={toolbarAnimatedStyle} pointerEvents={showToolbar ? 'auto' : 'none'}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolbarContent}
            >
              {renderToolbarChip(t('input.upload_attachment', '上传附件'), handleUploadAttachment, {
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
                  : t('agent.chat.tts_manual', '手动朗读'),
                onToggleTtsMode,
                { active: ttsMode === 'always', icon: 'volume-up' }
              )}
              {renderToolbarChip(t('settings.agent_tools_title', '工具管理'), onOpenTools, {
                icon: 'build'
              })}
            </ScrollView>
          </Animated.View>

          <View pointerEvents={composerEnabled ? 'auto' : 'none'}>
            <Input
              ref={inputRef}
              className="min-h-12 max-h-36"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.bgSurfaceHigh : colors.bgSurface
                }
              ]}
              value={text}
              onChangeText={handleChangeText}
              onKeyPress={handleKeyPress}
              placeholder={t('agent.chat.input_hint', '输入消息...')}
              multiline
              maxLength={4000}
              textAlignVertical="center"
              editable={composerEnabled}
              onFocus={composerEnabled ? onInputFocus : undefined}
              leftSlot={
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
              }
              rightSlot={
                isLoading ? (
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
                      (isSending || (!text.trim() && attachments.length === 0)) && {
                        backgroundColor: colors.textTertiary,
                        opacity: isSending ? 0.72 : 1
                      }
                    ]}
                    onPress={handleSend}
                    disabled={isSending || (!text.trim() && attachments.length === 0)}
                    accessibilityLabel={t('common.send', '发送')}
                  >
                    <MaterialIcons name="arrow-upward" size={18} color={colors.textOnPrimary} />
                  </TouchableOpacity>
                )
              }
            />
          </View>
        </View>
      </View>
    )
  }
)

InputBar.displayName = 'InputBar'

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  composerBlock: {
    position: 'relative'
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  toolbarToggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  input: {
    minHeight: 48,
    maxHeight: 140,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null)
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
