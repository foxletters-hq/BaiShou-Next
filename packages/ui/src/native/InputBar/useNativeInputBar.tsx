import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputKeyPressEventData
} from 'react-native'
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import {
  type MockChatAttachment,
  type PromptShortcut,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcuts
} from '@baishou/shared'
import { useComposerDraft, type ComposerSendSkillRef } from '../../shared/composer-draft'
import {
  buildNativeComposerSend,
  isSkillShortcut,
  normalizeRestoredSkillRefs,
  syncSkillRefsWithShortcuts
} from './composer-send-meta.util'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import { useNativeToast } from '../Toast'
import { useDialog } from '../Dialog'
import { useInputBarShortcuts } from '../../hooks/useInputBarShortcuts'
import { pickAttachmentsBySource, type AttachmentSourceChoice } from './attachment-picker.util'
import { Camera, FolderOpen, Image as ImageIcon } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import {
  EXPAND_ANIM_MS,
  INPUT_MAX_HEIGHT_COLLAPSED,
  INPUT_MIN_HEIGHT,
  composerContentWidth,
  estimateComposerContentHeight,
  resolveComposerHeight,
  resolveExpandedInputMaxHeight,
  TOOLBAR_ANIM_MS
} from './input-bar-height.util'
import type { InputBarProps, InputBarRef } from './input-bar.types'
import { resolveInlinePromptShortcutPanelHeight } from './InlinePromptShortcutList'

const EXPAND_HEIGHT_EASING = Easing.out(Easing.cubic)

export function useNativeInputBar(props: InputBarProps, ref: React.ForwardedRef<InputBarRef>) {
  const {
    onSend,
    isLoading,
    allowSendWhileLoading = false,
    onStop,
    onRecall,
    onOpenNotebookMount,
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
  } = props

  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const { colors, isDark } = useNativeTheme()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const inputRef = useRef<any>(null)
  const contentHeightRef = useRef(INPUT_MIN_HEIGHT)
  const textRef = useRef('')
  const contentWidth = composerContentWidth(windowWidth)
  const contentWidthRef = useRef(contentWidth)
  contentWidthRef.current = contentWidth
  const verticalPadding = Platform.OS === 'ios' ? 16 : 12
  const verticalPaddingRef = useRef(verticalPadding)
  verticalPaddingRef.current = verticalPadding
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [skillRefs, setSkillRefs] = useState<ComposerSendSkillRef[]>([])
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
  /** 退场动画期间保留打开时的高度，避免输入区上跳；打开时的高度在渲染阶段同步算出 */
  const [retainedShortcutPanelHeight, setShortcutPanelHeight] = useState(0)
  const toolbarProgress = useSharedValue(1)
  const inputHeightSv = useSharedValue(INPUT_MIN_HEIGHT)
  const inputMaxHeight = isExpanded
    ? resolveExpandedInputMaxHeight(windowHeight)
    : INPUT_MAX_HEIGHT_COLLAPSED
  const localizedShortcuts = useMemo(() => {
    if (!shortcuts?.length) return undefined
    return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
  }, [shortcuts, t])
  const shortcutHandlers = useInputBarShortcuts(text, setText, localizedShortcuts)

  useEffect(() => {
    setSkillRefs((prev) => syncSkillRefsWithShortcuts(prev, localizedShortcuts))
  }, [localizedShortcuts])

  /**
   * 与面板同帧预留高度：不能依赖子组件 layout 回调，否则首帧面板会先叠在输入区上再跳上去。
   * 面板关闭后继续沿用退场期间的高度，等退场动画结束由子组件回调清零。
   */
  const shortcutPanelHeight = shortcutHandlers.shortcutModeActive
    ? resolveInlinePromptShortcutPanelHeight(shortcutHandlers.filteredShortcuts.length)
    : retainedShortcutPanelHeight

  const applyComposerShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      if (isSkillShortcut(shortcut) && shortcut.command) {
        const command = shortcut.command.replace(/^\//, '')
        setSkillRefs((prev) =>
          prev.some((item) => item.command === command)
            ? prev
            : [...prev, { command, content: shortcut.content }]
        )
        setText((prev) => (prev.startsWith('/') ? '' : prev))
        shortcutHandlers.endShortcutSession()
        return
      }
      shortcutHandlers.applyShortcut(shortcut)
    },
    [shortcutHandlers]
  )

  const removeSkillRef = useCallback((command: string) => {
    const normalized = command.replace(/^\//, '')
    setSkillRefs((prev) => prev.filter((item) => item.command !== normalized))
  }, [])

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
  const applyContentHeightRef = useRef(applyContentHeight)
  applyContentHeightRef.current = applyContentHeight

  const isExpandedRef = useRef(isExpanded)
  const wasExpandedRef = useRef(isExpanded)
  isExpandedRef.current = isExpanded
  const ignoreContentSizeUntilRef = useRef(0)

  useEffect(() => {
    textRef.current = text
    ignoreContentSizeUntilRef.current = Date.now() + 48
    applyContentHeightRef.current(
      estimateComposerContentHeight(text, contentWidth, verticalPadding),
      isExpandedRef.current,
      false
    )
  }, [text, contentWidth, verticalPadding])

  useEffect(() => {
    const expandedChanged = wasExpandedRef.current !== isExpanded
    wasExpandedRef.current = isExpanded
    applyContentHeight(contentHeightRef.current, isExpanded, expandedChanged)
  }, [applyContentHeight, isExpanded])

  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      if (Date.now() < ignoreContentSizeUntilRef.current) return
      const estimated = estimateComposerContentHeight(
        textRef.current,
        contentWidthRef.current,
        verticalPaddingRef.current
      )
      applyContentHeight(
        Math.max(event.nativeEvent.contentSize.height, estimated),
        isExpandedRef.current,
        false
      )
    },
    [applyContentHeight]
  )

  const toggleExpand = useCallback(() => setIsExpanded((prev) => !prev), [])

  const toggleToolbar = useCallback(() => {
    setShowToolbar((prev) => {
      const next = !prev
      toolbarProgress.value = withTiming(next ? 1 : 0, {
        duration: TOOLBAR_ANIM_MS,
        easing: EXPAND_HEIGHT_EASING
      })
      return next
    })
  }, [toolbarProgress])

  const dismissComposerKeyboard = useCallback(() => {
    inputRef.current?.blur?.()
    Keyboard.dismiss()
  }, [])

  const focusRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const focusComposerInput = useCallback(() => {
    if (!composerEnabled) return
    const input = inputRef.current
    if (!input) return
    if (focusRetryTimerRef.current) {
      clearTimeout(focusRetryTimerRef.current)
      focusRetryTimerRef.current = null
    }
    const alreadyFocused = Boolean(input.isFocused?.())
    const keyboardShown = Keyboard.isVisible?.() === true
    if (alreadyFocused && !keyboardShown) {
      // Android 系统返回手势或列表滑动收起软键盘后，TextInput 仍残留原生焦点；
      // 直接调 focus() 会被原生 requestFocus 短路忽略，需先 blur 再重新 focus 以拉起软键盘。
      input.blur?.()
      focusRetryTimerRef.current = setTimeout(() => {
        focusRetryTimerRef.current = null
        inputRef.current?.focus?.()
      }, 16)
      return
    }
    input.focus?.()
  }, [composerEnabled])

  const handleInputPressIn = useCallback(() => {
    if (!composerEnabled) return
    onInputFocus?.()
  }, [composerEnabled, onInputFocus])

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (Keyboard.isVisible?.() !== true && inputRef.current?.isFocused?.()) {
        inputRef.current?.blur?.()
      }
    })
    return () => {
      sub.remove()
      if (focusRetryTimerRef.current) {
        clearTimeout(focusRetryTimerRef.current)
        focusRetryTimerRef.current = null
      }
    }
  }, [])

  const handleUploadAttachment = useCallback(async () => {
    dismissComposerKeyboard()
    const iconColor = colors.textSecondary
    const choice = (await dialog.choose(
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
    )) as AttachmentSourceChoice | null
    if (!choice) return

    try {
      const result = await pickAttachmentsBySource(choice)
      if (!result.ok) {
        if (result.reason === 'permission_denied') {
          toast.showError(t('input.attachment_permission_denied', '需要相机或相册权限才能继续'))
        } else if (result.reason === 'text_too_large') {
          toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
        }
        return
      }
      setAttachments((prev) => [...prev, ...result.attachments])
    } catch (err) {
      console.warn('Attachment picker error:', err)
    }
  }, [colors.textSecondary, dialog, dismissComposerKeyboard, t, toast])

  useImperativeHandle(ref, () => ({
    insertText: (newText: string) => {
      setText((prev) => (prev ? `${prev}\n${newText}` : newText))
      setTimeout(() => focusComposerInput(), 0)
    },
    setText: (nextText: string) => {
      textRef.current = nextText
      setText(nextText)
    },
    restoreDraft: (draft) => {
      const nextText = typeof draft.text === 'string' ? draft.text : ''
      textRef.current = nextText
      setText(nextText)
      if (draft.skillRefs) {
        setSkillRefs(normalizeRestoredSkillRefs(draft.skillRefs))
      } else if (!nextText) {
        setSkillRefs([])
      }
    },
    insertShortcutContent: (content: string) => {
      shortcutHandlers.insertShortcutContent(content)
      setTimeout(() => focusComposerInput(), 0)
    },
    applyShortcut: (shortcut: PromptShortcut) => {
      applyComposerShortcut(shortcut)
      setTimeout(() => focusComposerInput(), 0)
    },
    focus: () => focusComposerInput(),
    blur: () => inputRef.current?.blur?.()
  }))

  const handleSend = useCallback(async () => {
    if (shortcutHandlers.shortcutModeActive && textRef.current.startsWith('/')) return

    /**
     * 吞字根治：若输入框处于聚焦态（用户刚打完字或输入法处于 composing 状态），
     * 先主动失焦促使 Android/iOS 输入法提交组合文字（finishComposingText），
     * 并微延迟 32ms 让出 JS 宏任务时间片，确保原生事件队列将派发的 onChangeText 消费完毕，
     * 保证随后读取的 textRef.current 为最新全量文本。
     */
    if (inputRef.current?.isFocused?.()) {
      inputRef.current?.blur?.()
      await new Promise((resolve) => setTimeout(resolve, 32))
    }

    const latestText = textRef.current
    if (shortcutHandlers.shortcutModeActive && latestText.startsWith('/')) return
    if (!latestText.trim() && attachments.length === 0 && skillRefs.length === 0) return
    if ((isLoading && !allowSendWhileLoading) || isSending) return

    if (composerBlocked) {
      onComposerBlocked?.()
      return
    }

    const pendingText = latestText
    const pendingAttachments = attachments.length > 0 ? [...attachments] : []
    const pendingSkills = syncSkillRefsWithShortcuts(skillRefs, localizedShortcuts)
    const composed = buildNativeComposerSend({
      text: pendingText,
      skillRefs: pendingSkills,
      attachments: pendingAttachments
    })

    textRef.current = ''
    setText('')
    setAttachments([])
    setSkillRefs([])
    setIsExpanded(false)
    contentHeightRef.current = INPUT_MIN_HEIGHT
    setInputScrollEnabled(false)
    animateInputHeight(INPUT_MIN_HEIGHT, true)
    dismissComposerKeyboard()

    setIsSending(true)
    try {
      const accepted = await Promise.resolve(
        onSend(
          composed.modelText,
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
          undefined,
          composed.meta
        )
      )
      if (accepted === false) {
        textRef.current = pendingText
        setText(pendingText)
        setAttachments(pendingAttachments)
        setSkillRefs(pendingSkills)
      } else {
        await clearDraft()
      }
    } finally {
      setIsSending(false)
    }
  }, [
    allowSendWhileLoading,
    animateInputHeight,
    attachments,
    clearDraft,
    composerBlocked,
    dismissComposerKeyboard,
    isLoading,
    isSending,
    localizedShortcuts,
    onComposerBlocked,
    onSend,
    shortcutHandlers.shortcutModeActive,
    skillRefs
  ])

  const wrapWithDismiss = useCallback(
    (action?: () => void) =>
      action
        ? () => {
            dismissComposerKeyboard()
            action()
          }
        : undefined,
    [dismissComposerKeyboard]
  )

  const handleShortcutPress = useCallback(() => {
    dismissComposerKeyboard()
    onManageShortcuts?.()
  }, [dismissComposerKeyboard, onManageShortcuts])

  const handleChangeText = useCallback(
    (nextText: string) => {
      const prevText = textRef.current
      textRef.current = nextText
      if (shortcuts?.length) {
        shortcutHandlers.handleTextChangeForShortcuts(prevText, nextText)
      } else if (nextText === '/' && prevText === '' && onTriggerShortcut) {
        onTriggerShortcut()
      }
      setText(nextText)
    },
    [shortcuts, shortcutHandlers, onTriggerShortcut]
  )

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (shortcutHandlers.tryHandleShortcutKey(event.nativeEvent.key)) {
        event.preventDefault?.()
      }
    },
    [shortcutHandlers]
  )

  return {
    t,
    colors,
    isDark,
    inputRef,
    text,
    attachments,
    setAttachments,
    skillRefs,
    removeSkillRef,
    isSending,
    isExpanded,
    inputHeight,
    inputScrollEnabled,
    showToolbar,
    shortcutPanelHeight,
    setShortcutPanelHeight,
    toolbarProgress,
    inputHeightSv,
    shortcutHandlers,
    applyComposerShortcut,
    handleContentSizeChange,
    toggleExpand,
    toggleToolbar,
    handleUploadAttachment,
    handleSend,
    handleShortcutPress,
    handleChangeText,
    handleKeyPress,
    focusComposerInput,
    handleInputPressIn,
    searchMode,
    onToggleSearchMode,
    ttsMode,
    onToggleTtsMode,
    onInputFocus,
    onHeightChange,
    composerEnabled,
    isLoading,
    allowSendWhileLoading,
    onStop,
    onRecall: wrapWithDismiss(onRecall),
    onOpenNotebookMount: wrapWithDismiss(onOpenNotebookMount),
    onOpenTools: wrapWithDismiss(onOpenTools)
  }
}
