import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react'
import { Keyboard, Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import type {
  DiaryCmConfirmRequestPayload,
  DiaryCmTheme,
  DiaryCmMarkdownMark
} from '../../shared/diary-codemirror/types'
import { useDialog } from '../Dialog/Dialog'
import { useNativeTheme } from '../theme'
import { buildDiaryCmThemeFromNative } from './diary-cm-theme.util'
import {
  useDiaryCodeMirrorBridge,
  type UseDiaryCodeMirrorBridgeOptions
} from './useDiaryCodeMirrorBridge'

const EDITOR_MIN_HEIGHT = 320

export interface DiaryEditorWebViewDocument {
  uri: string
  baseUrl: string
  /** bundle 版本戳；变化时强制 WebView remount */
  cacheKey: string
}

export interface NativeDiaryCodeMirrorEditorHandle {
  focusAtOffset: (offset: number) => void
  blur: () => void
  insertAtCursor: (text: string) => void
  insertAtRange: (start: number, end: number, text: string) => void
  undo: () => void
  redo: () => void
  toggleMarkdownMark: (marker: DiaryCmMarkdownMark) => void
  deleteRange: (from: number, to: number) => void
}

export interface NativeDiaryCodeMirrorEditorProps extends Pick<
  UseDiaryCodeMirrorBridgeOptions,
  | 'content'
  | 'placeholder'
  | 'editable'
  | 'onChange'
  | 'onSelectionChange'
  | 'onFocus'
  | 'onBlur'
  | 'onContentHeight'
  | 'onCaretViewport'
  | 'onPanScroll'
  | 'tagColorRegistry'
  | 'onImageAction'
  | 'onImagePreview'
  | 'resolveAttachmentUrl'
  | 'onDismissKeyboard'
  | 'onConfirmRequest'
  | 'onTableSheetRequest'
> {
  /** WebView 文档（同目录 index.html + bundle，由宿主 app 预加载后传入） */
  editorWebViewSource: DiaryEditorWebViewDocument
  /** 页面聚焦时为 true；失焦时仅 blur，不卸载 WebView（避免模态动画期间反复 reload） */
  active?: boolean
  /** 键盘弹出高度，用于 WebView 容器底部 inset（I-13） */
  keyboardInset?: number
  /** WebView 内滚动时需预留的底部遮挡高度（如 RN 浮动工具栏） */
  bottomScrollInset?: number
  /** 可选：覆盖默认主题；未传时从 useNativeTheme 推导 */
  theme?: DiaryCmTheme
  /** WebView 内容区最小高度（仅加载占位） */
  minHeight?: number
  /** 填满父级剩余空间，在固定顶栏布局下启用 */
  fillViewport?: boolean
  style?: ViewStyle
}

export const NativeDiaryCodeMirrorEditor = forwardRef<
  NativeDiaryCodeMirrorEditorHandle,
  NativeDiaryCodeMirrorEditorProps
>(function NativeDiaryCodeMirrorEditor(
  {
    editorWebViewSource,
    content,
    placeholder,
    editable = true,
    active = true,
    keyboardInset = 0,
    bottomScrollInset = 0,
    theme: themeOverride,
    onChange,
    onSelectionChange,
    onFocus,
    onBlur,
    onContentHeight,
    onCaretViewport,
    onPanScroll,
    tagColorRegistry,
    onImageAction,
    onImagePreview,
    resolveAttachmentUrl,
    onDismissKeyboard,
    onConfirmRequest,
    onTableSheetRequest,
    style,
    minHeight = EDITOR_MIN_HEIGHT,
    fillViewport = false
  },
  ref
) {
  const { colors, isDark } = useNativeTheme()
  const theme = useMemo(
    () => themeOverride ?? buildDiaryCmThemeFromNative(isDark, colors),
    [colors, isDark, themeOverride]
  )

  const dialog = useDialog()

  const defaultDismissKeyboard = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const defaultConfirmRequest = useCallback(
    (payload: DiaryCmConfirmRequestPayload, respond: (confirmed: boolean) => void) => {
      void dialog
        .confirm(payload.message, {
          title: payload.title ?? '确认删除',
          confirmText: payload.confirmText ?? '删除',
          cancelText: payload.cancelText ?? '取消',
          destructive: payload.destructive ?? true
        })
        .then(respond)
    },
    [dialog]
  )

  const handleDismissKeyboard = onDismissKeyboard ?? defaultDismissKeyboard
  const handleConfirmRequest = onConfirmRequest ?? defaultConfirmRequest

  const bridge = useDiaryCodeMirrorBridge({
    content,
    placeholder,
    theme,
    editable,
    onChange,
    onSelectionChange,
    onFocus,
    onBlur,
    onContentHeight,
    onCaretViewport,
    onPanScroll,
    tagColorRegistry,
    onImageAction,
    onImagePreview,
    resolveAttachmentUrl,
    bottomScrollInset,
    onDismissKeyboard: handleDismissKeyboard,
    onConfirmRequest: handleConfirmRequest,
    onTableSheetRequest
  })

  useEffect(() => {
    if (!active) bridge.blur()
  }, [active, bridge.blur])

  const prevKeyboardInsetRef = useRef(0)
  const editorReadyAtRef = useRef(0)
  const EDITOR_KEYBOARD_SCROLL_GRACE_MS = 2000

  useEffect(() => {
    if (__DEV__) {
      console.log('[DiaryEditor] setScrollInsets', {
        bottomScrollInset,
        keyboardInset,
        keyboardVisible: keyboardInset > 0
      })
    }
    bridge.setScrollInsets(bottomScrollInset, keyboardInset > 0)
  }, [bottomScrollInset, keyboardInset, bridge.setScrollInsets])

  useEffect(() => {
    const prev = prevKeyboardInsetRef.current
    prevKeyboardInsetRef.current = keyboardInset
    if (keyboardInset <= 0) return
    if (prev > 0) return
    const readyAt = editorReadyAtRef.current
    if (readyAt > 0 && Date.now() - readyAt < EDITOR_KEYBOARD_SCROLL_GRACE_MS) return
    const delayMs = Platform.OS === 'ios' ? 120 : 220
    const timer = setTimeout(() => {
      if (Date.now() - editorReadyAtRef.current < EDITOR_KEYBOARD_SCROLL_GRACE_MS) return
      bridge.scrollCaretIntoView()
    }, delayMs)
    const retryTimer = setTimeout(() => {
      if (Date.now() - editorReadyAtRef.current < EDITOR_KEYBOARD_SCROLL_GRACE_MS) return
      bridge.scrollCaretIntoView()
    }, delayMs + 320)
    return () => {
      clearTimeout(timer)
      clearTimeout(retryTimer)
    }
  }, [keyboardInset, bridge.scrollCaretIntoView])

  useImperativeHandle(
    ref,
    () => ({
      focusAtOffset: bridge.focusAtOffset,
      blur: bridge.blur,
      insertAtCursor: bridge.insertAtCursor,
      insertAtRange: bridge.insertAtRange,
      undo: bridge.undo,
      redo: bridge.redo,
      toggleMarkdownMark: bridge.toggleMarkdownMark,
      deleteRange: bridge.deleteRange
    }),
    [
      bridge.blur,
      bridge.focusAtOffset,
      bridge.insertAtCursor,
      bridge.insertAtRange,
      bridge.redo,
      bridge.toggleMarkdownMark,
      bridge.undo,
      bridge.deleteRange
    ]
  )

  const webViewSource = useMemo(
    () => ({
      uri: editorWebViewSource.uri,
      baseUrl: editorWebViewSource.baseUrl
    }),
    [editorWebViewSource.baseUrl, editorWebViewSource.uri]
  )

  const editorBackground = theme.bgEditor

  const editorBlockHeight = Math.max(minHeight, EDITOR_MIN_HEIGHT)

  const shellStyle = useMemo(
    () => [
      styles.shell,
      fillViewport
        ? {
            flex: 1,
            marginBottom: keyboardInset > 0 ? keyboardInset : 0,
            backgroundColor: editorBackground
          }
        : {
            minHeight: editorBlockHeight,
            marginBottom: keyboardInset > 0 ? keyboardInset : 0,
            backgroundColor: editorBackground
          },
      style
    ],
    [editorBackground, editorBlockHeight, fillViewport, keyboardInset, style]
  )

  const webViewStyle = useMemo(
    () => [
      styles.webView,
      fillViewport
        ? { flex: 1, backgroundColor: editorBackground }
        : { backgroundColor: editorBackground, height: editorBlockHeight }
    ],
    [editorBackground, editorBlockHeight, fillViewport]
  )

  const webViewContainerStyle = useMemo(
    () => [
      styles.webViewContainer,
      fillViewport
        ? { flex: 1, backgroundColor: editorBackground }
        : { backgroundColor: editorBackground, height: editorBlockHeight }
    ],
    [editorBackground, editorBlockHeight, fillViewport]
  )

  const handleWebViewError = (event: { nativeEvent: { description?: string } }) => {
    console.error('[DiaryEditor WebView] error:', event.nativeEvent.description ?? 'load error')
  }

  const handleConsoleMessage = (event: { nativeEvent: { message?: string } }) => {
    if (event.nativeEvent.message) {
      console.log('[DiaryEditor WebView]', event.nativeEvent.message)
    }
  }

  const webViewCacheKey = `${editorWebViewSource.uri}:${editorWebViewSource.cacheKey}`

  const handleLoadStart = () => {
    prevKeyboardInsetRef.current = 0
    editorReadyAtRef.current = 0
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[DiaryEditor WebView] loadStart', {
        uri: editorWebViewSource.uri,
        cacheKey: editorWebViewSource.cacheKey
      })
    }
    bridge.onWebViewLoadStart()
  }

  const handleLoadEnd = () => {
    editorReadyAtRef.current = Date.now()
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[DiaryEditor WebView] loadEnd')
    }
    bridge.onWebViewLoadEnd()
  }

  return (
    <View style={shellStyle} collapsable={false}>
      <WebView
        key={webViewCacheKey}
        ref={bridge.webViewRef}
        source={webViewSource}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={bridge.onWebViewMessage}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
        {...(Platform.OS === 'android'
          ? ({ onConsoleMessage: handleConsoleMessage } as Record<string, unknown>)
          : {})}
        style={webViewStyle}
        containerStyle={webViewContainerStyle}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        {...(Platform.OS === 'ios'
          ? {
              allowingReadAccessToURL: editorWebViewSource.baseUrl,
              dataDetectorTypes: 'none' as const
            }
          : {})}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden'
  },
  webViewContainer: {
    width: '100%'
  },
  webView: {
    width: '100%'
  }
})
