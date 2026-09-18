import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputKeyPressEventData
} from 'react-native'
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import type { MockChatAttachment, PromptShortcut } from '@baishou/shared'
import { getDefaultShortcutLabelsFromT, localizePromptShortcuts } from '@baishou/shared'
import type { ComposerSendSkillRef } from '../../shared/composer-draft'
import { buildNativeComposerSend, isSkillShortcut } from './composer-send-meta.util'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import { useNativeToast } from '../Toast'
import { useDialog } from '../Dialog'
import { useInputBarShortcuts } from '../../hooks/useInputBarShortcuts'
import {
  pickAttachmentsFromCamera,
  pickAttachmentsFromFileManager,
  pickAttachmentsFromPhotoLibrary,
  type PickAttachmentsResult
} from './attachment-picker.util'
import { useComposerDraft } from '../../shared/composer-draft'
import { Camera, FolderOpen, Image as ImageIcon } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import {
  EXPAND_ANIM_MS,
  INPUT_MAX_HEIGHT_COLLAPSED,
  INPUT_MIN_HEIGHT,
  resolveComposerHeight,
  resolveExpandedInputMaxHeight,
  TOOLBAR_ANIM_MS
} from './input-bar-height.util'
import type { InputBarProps, InputBarRef } from './input-bar.types'

const EXPAND_HEIGHT_EASING = Easing.out(Easing.cubic)

export function useNativeInputBar(props: InputBarProps, ref: React.ForwardedRef<InputBarRef>) {
  const {
    onSend,
    isLoading,
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
  const { height: windowHeight } = useWindowDimensions()
  const inputRef = useRef<any>(null)
  const contentHeightRef = useRef(INPUT_MIN_HEIGHT)
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
  const [shortcutPanelHeight, setShortcutPanelHeight] = useState(0)
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

  const applyComposerShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      if (isSkillShortcut(shortcut) && shortcut.command) {
        const command = shortcut.command.replace(/^\//, '')
        setSkillRefs((prev) =>
          prev.some((item) => item.command === command)
            ? prev
            : [...prev, { command, content: shortcut.content }]
        )
        setText((prev) => {
          const rest = prev.startsWith('/') ? '' : prev
          const token = `/${command}`
          return rest.includes(token) ? rest : `${rest}${rest ? ' ' : ''}${token}`.trim()
        })
        shortcutHandlers.endShortcutSession()
        return
      }
      shortcutHandlers.applyShortcut(shortcut)
    },
    [shortcutHandlers]
  )

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
    setShowToolbar((prev) => {
      const next = !prev
      toolbarProgress.value = withTiming(next ? 1 : 0, { duration: TOOLBAR_ANIM_MS })
      return next
    })
  }, [toolbarProgress])

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
    if (!text.trim() && attachments.length === 0 && skillRefs.length === 0) return
    if (isLoading || isSending) return

    if (composerBlocked) {
      onComposerBlocked?.()
      return
    }

    const pendingText = text
    const pendingAttachments = attachments.length > 0 ? [...attachments] : []
    const pendingSkills = [...skillRefs]
    const composed = buildNativeComposerSend({
      text: pendingText,
      skillRefs: pendingSkills,
      attachments: pendingAttachments
    })

    setText('')
    setAttachments([])
    setSkillRefs([])
    setIsExpanded(false)
    contentHeightRef.current = INPUT_MIN_HEIGHT
    setInputScrollEnabled(false)
    animateInputHeight(INPUT_MIN_HEIGHT, true)

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
    animateInputHeight,
    attachments,
    clearDraft,
    composerBlocked,
    isLoading,
    isSending,
    onComposerBlocked,
    onSend,
    shortcutHandlers.shortcutModeActive,
    skillRefs,
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

  return {
    t,
    colors,
    isDark,
    inputRef,
    text,
    attachments,
    setAttachments,
    skillRefs,
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
    onRecall,
    onOpenNotebookMount,
    onOpenTools,
    searchMode,
    onToggleSearchMode,
    ttsMode,
    onToggleTtsMode,
    onInputFocus,
    onHeightChange,
    composerEnabled,
    isLoading,
    onStop
  }
}
