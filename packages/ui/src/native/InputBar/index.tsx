import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
  useMemo,
  useEffect
} from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputKeyPressEventData
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import type { LucideProps } from 'lucide-react-native'
import {
  BookOpen,
  Camera,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Maximize2,
  Menu,
  Minimize2,
  Paperclip,
  Send,
  Volume2,
  Zap
} from 'lucide-react-native'
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
import { DEFAULT_STROKE_WIDTH, INPUT_BAR_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { LucideIcon } from '../icons/LucideIcon'

const TOOLBAR_ANIM_MS = 200
/** 展开/收起输入框高度动画，与工具栏开合节奏一致 */
const EXPAND_ANIM_MS = 200
const INPUT_MIN_HEIGHT = 36
/** 点击展开后立刻抬高到的高度（不必等内容或键盘） */
const INPUT_EXPANDED_DEFAULT_HEIGHT = 120
/** 折叠态输入区最大高度（约 4–5 行） */
const INPUT_MAX_HEIGHT_COLLAPSED = 112
/** 展开态相对屏幕高度的比例上限 */
const INPUT_MAX_HEIGHT_EXPANDED_RATIO = 0.42
/** 展开态最大高度硬顶 */
const INPUT_MAX_HEIGHT_EXPANDED_CAP = 320
/** 卡片内底栏（菜单 + 发送） */
const INPUT_CARD_BOTTOM_ROW = 36

const EXPAND_HEIGHT_EASING = Easing.out(Easing.cubic)

function clampInputFrameHeight(contentHeight: number, maxHeight: number) {
  return Math.min(Math.max(Math.ceil(contentHeight), INPUT_MIN_HEIGHT), maxHeight)
}

function resolveComposerHeight(
  contentHeight: number,
  expanded: boolean,
  maxHeight: number
): number {
  const contentBased = clampInputFrameHeight(contentHeight, maxHeight)
  if (!expanded) return contentBased
  return Math.min(Math.max(contentBased, INPUT_EXPANDED_DEFAULT_HEIGHT), maxHeight)
}

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
  /** 整栏高度变化（展开/工具栏/多行）时回调，供外层列表留白跟高 */
  onHeightChange?: (height: number) => void
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
      searchMode = true,
      onToggleSearchMode,
      ttsMode = 'manual',
      onToggleTtsMode,
      onInputFocus,
      onHeightChange,
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
    const { height: windowHeight } = useWindowDimensions()
    const inputRef = useRef<any>(null)
    const contentHeightRef = useRef(INPUT_MIN_HEIGHT)
    const [text, setText] = useState('')
    const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
    const [isSending, setIsSending] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT)
    const [inputScrollEnabled, setInputScrollEnabled] = useState(false)
    const { clearDraft } = useComposerDraft({
      draftKey: composerDraftKey,
      draftStorage: composerDraftStorage,
      text,
      setText,
      draftSyncSuspended: isSending
    })
    const [showToolbar, setShowToolbar] = useState(true)
    const [shortcutPanelHeight, setShortcutPanelHeight] = useState(0)
    const toolbarProgress = useSharedValue(1)
    const inputHeightSv = useSharedValue(INPUT_MIN_HEIGHT)
    const inputMaxHeight = isExpanded
      ? Math.min(
          INPUT_MAX_HEIGHT_EXPANDED_CAP,
          Math.round(windowHeight * INPUT_MAX_HEIGHT_EXPANDED_RATIO)
        )
      : INPUT_MAX_HEIGHT_COLLAPSED
    const localizedShortcuts = useMemo(() => {
      if (!shortcuts?.length) return undefined
      return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
    }, [shortcuts, t, i18n.language])
    const shortcutHandlers = useInputBarShortcuts(text, setText, localizedShortcuts)

    const animateInputHeight = useCallback(
      (nextHeight: number, animated: boolean) => {
        if (animated) {
          inputHeightSv.value = withTiming(nextHeight, {
            duration: EXPAND_ANIM_MS,
            easing: EXPAND_HEIGHT_EASING
          })
        } else {
          cancelAnimation(inputHeightSv)
          inputHeightSv.value = nextHeight
        }
        setInputHeight((prev) => (Math.abs(prev - nextHeight) < 1 ? prev : nextHeight))
      },
      [inputHeightSv]
    )

    const applyContentHeight = useCallback(
      (contentHeight: number, expanded = isExpanded, animated = false) => {
        contentHeightRef.current = contentHeight
        const nextHeight = resolveComposerHeight(contentHeight, expanded, inputMaxHeight)
        const shouldScroll = contentHeight > inputMaxHeight + 1
        setInputScrollEnabled((prev) => (prev === shouldScroll ? prev : shouldScroll))
        animateInputHeight(nextHeight, animated)
      },
      [animateInputHeight, inputMaxHeight, isExpanded]
    )

    const isExpandedRef = useRef(isExpanded)
    useEffect(() => {
      const expandedChanged = isExpandedRef.current !== isExpanded
      isExpandedRef.current = isExpanded
      // 展开态切换时做高度过渡；仅上限变化（如旋转屏幕）则直接对齐
      applyContentHeight(contentHeightRef.current, isExpanded, expandedChanged)
    }, [applyContentHeight, isExpanded])

    const handleContentSizeChange = useCallback(
      (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
        applyContentHeight(event.nativeEvent.contentSize.height, isExpanded, false)
      },
      [applyContentHeight, isExpanded]
    )

    const toggleExpand = useCallback(() => {
      setIsExpanded((prev) => !prev)
    }, [])

    const toggleToolbar = useCallback(() => {
      // 仅用 reanimated 收起工具栏，避免 LayoutAnimation 牵动 TextInput 导致 placeholder 跳动/裁切
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

    const inputFrameAnimatedStyle = useAnimatedStyle(() => ({
      height: inputHeightSv.value,
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
            leading: <Camera size={22} color={iconColor} strokeWidth={DEFAULT_STROKE_WIDTH} />
          },
          {
            label: t('input.attachment_photo_library', '相册'),
            value: 'album',
            centered: true,
            leading: <ImageIcon size={22} color={iconColor} strokeWidth={DEFAULT_STROKE_WIDTH} />
          },
          {
            label: t('input.attachment_file_manager', '文件管理'),
            value: 'files',
            centered: true,
            leading: <FolderOpen size={22} color={iconColor} strokeWidth={DEFAULT_STROKE_WIDTH} />
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

      const pendingText = text
      const pendingAttachments = attachments.length > 0 ? [...attachments] : []

      setText('')
      setAttachments([])
      setIsExpanded(false)
      contentHeightRef.current = INPUT_MIN_HEIGHT
      setInputScrollEnabled(false)
      animateInputHeight(INPUT_MIN_HEIGHT, true)

      setIsSending(true)
      try {
        const accepted = await Promise.resolve(
          onSend(pendingText.trim(), pendingAttachments.length > 0 ? pendingAttachments : undefined)
        )
        if (accepted === false) {
          setText(pendingText)
          setAttachments(pendingAttachments)
        } else {
          await clearDraft()
        }
      } finally {
        setIsSending(false)
      }
    }, [
      animateInputHeight,
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
      options?: { active?: boolean; icon?: React.ComponentType<LucideProps> }
    ) => {
      if (!onPress) return null
      const active = options?.active ?? false
      return (
        <TouchableOpacity
          key={label}
          style={[
            styles.chip,
            {
              backgroundColor: active ? colors.primary : colors.bgSurface,
              borderColor: active ? colors.primary : colors.colorOutlineVariant
            }
          ]}
          onPress={onPress}
        >
          {options?.icon ? (
            <LucideIcon
              icon={options.icon}
              size={INPUT_BAR_ICON_SIZE}
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
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height)
          if (next > 0) onHeightChange?.(next)
        }}
        style={styles.container}
      >
        <View
          style={[
            styles.composerBlock,
            shortcutPanelHeight > 0 ? { paddingTop: shortcutPanelHeight } : null
          ]}
        >
          <View style={styles.composerChromeAnchor}>
            <InlinePromptShortcutList
              visible={shortcutHandlers.shortcutModeActive}
              shortcuts={shortcutHandlers.filteredShortcuts}
              selectedIndex={shortcutHandlers.selectedIndex}
              onSelect={shortcutHandlers.applyShortcut}
              onHeightChange={setShortcutPanelHeight}
            />

            <View
              style={[
                styles.composerChrome,
                {
                  borderTopColor: colors.borderSubtle,
                  backgroundColor: colors.bgSurface
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
                          <Text style={styles.attDocIcon}>
                            {att.isPdf || att.isText ? '📄' : '📁'}
                          </Text>
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
                        onPress={() =>
                          setAttachments((prev) => prev.filter((p) => p.id !== att.id))
                        }
                      >
                        <Text style={[styles.attRemoveLabel, { color: colors.textOnPrimary }]}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <Animated.View
                style={toolbarAnimatedStyle}
                pointerEvents={showToolbar ? 'auto' : 'none'}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.toolbarContent}
                >
                  {renderToolbarChip(
                    t('input.upload_attachment', '上传附件'),
                    handleUploadAttachment,
                    { icon: Paperclip }
                  )}
                  {renderToolbarChip(t('input.shortcut_command', '快捷指令'), handleShortcutPress, {
                    icon: Zap
                  })}
                  {renderToolbarChip(t('settings.recall_memories', '唤醒回忆'), onRecall, {
                    icon: BookOpen
                  })}
                  {renderToolbarChip(
                    searchMode
                      ? t('settings.web_search_mode_tool', '外部工具搜索')
                      : t('settings.web_search_mode_off', '关闭搜索'),
                    onToggleSearchMode,
                    { active: searchMode, icon: Globe }
                  )}
                  {renderToolbarChip(
                    ttsMode === 'always'
                      ? t('agent.chat.tts_always', '始终朗读')
                      : t('agent.chat.tts_manual', '手动朗读'),
                    onToggleTtsMode,
                    { active: ttsMode === 'always', icon: Volume2 }
                  )}
                  {renderToolbarChip(t('settings.agent_tools_title', '工具管理'), onOpenTools, {
                    icon: LayoutGrid
                  })}
                </ScrollView>
              </Animated.View>

              <View
                pointerEvents={composerEnabled ? 'auto' : 'none'}
                style={[
                  styles.inputCard,
                  {
                    backgroundColor: isDark ? colors.bgSurfaceHigh : colors.bgSurface,
                    borderColor: colors.borderStrong
                  }
                ]}
              >
                <View
                  style={[
                    styles.topRow,
                    inputHeight <= INPUT_MIN_HEIGHT + 1 ? styles.topRowSingleLine : null
                  ]}
                >
                  <Animated.View style={[styles.inputWrapper, inputFrameAnimatedStyle]}>
                    <Input
                      ref={inputRef}
                      bare
                      keyboardAware={false}
                      className="border-0 bg-transparent"
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          height: '100%'
                        }
                      ]}
                      value={text}
                      onChangeText={handleChangeText}
                      onKeyPress={handleKeyPress}
                      onContentSizeChange={handleContentSizeChange}
                      placeholder={t('agent.chat.input_hint', '输入消息...')}
                      multiline
                      scrollEnabled={inputScrollEnabled}
                      nestedScrollEnabled
                      textAlignVertical={
                        !isExpanded && inputHeight <= INPUT_MIN_HEIGHT + 1 ? 'center' : 'top'
                      }
                      editable={composerEnabled}
                      onFocus={composerEnabled ? onInputFocus : undefined}
                    />
                  </Animated.View>
                  <TouchableOpacity
                    style={[
                      styles.expandToggle,
                      inputHeight > INPUT_MIN_HEIGHT + 1 ? styles.expandToggleMultiline : null
                    ]}
                    onPress={toggleExpand}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel={
                      isExpanded
                        ? t('input.collapse', '折叠输入框')
                        : t('input.expand', '展开输入框')
                    }
                  >
                    <LucideIcon
                      icon={isExpanded ? Minimize2 : Maximize2}
                      size={16}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomRow}>
                  <TouchableOpacity
                    style={styles.toolbarToggle}
                    onPress={toggleToolbar}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <LucideIcon
                      icon={showToolbar ? LayoutGrid : Menu}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

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
                        !text.trim() &&
                          attachments.length === 0 && {
                            backgroundColor: colors.textTertiary
                          },
                        isSending && {
                          opacity: 0.72
                        }
                      ]}
                      onPress={handleSend}
                      disabled={isSending || (!text.trim() && attachments.length === 0)}
                      accessibilityLabel={t('common.send', '发送')}
                    >
                      <LucideIcon icon={Send} size={18} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }
)

InputBar.displayName = 'InputBar'

const styles = StyleSheet.create({
  container: {
    // 分割线与底栏背景放在 composerChrome，避免快捷面板撑开时整条顶边被抬起
  },
  composerBlock: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 20
  },
  composerChromeAnchor: {
    position: 'relative',
    zIndex: 1
  },
  composerChrome: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 10
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingTop: 6,
    paddingHorizontal: 10,
    paddingBottom: 6
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  topRowSingleLine: {
    alignItems: 'center'
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0
  },
  expandToggle: {
    width: 28,
    height: 28,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  expandToggleMultiline: {
    marginTop: 4
  },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    fontSize: 15,
    lineHeight: 20,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null)
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    height: INPUT_CARD_BOTTOM_ROW,
    flexShrink: 0
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
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
    justifyContent: 'center'
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
