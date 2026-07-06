import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import { Keyboard, Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import type {
  DiaryCmConfirmRequestPayload,
  DiaryCmMarkdownMark,
  DiaryCmTheme
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
  cacheKey?: string
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
  /** 页面聚焦时为 true；false 时卸载 WebView 释放内存（P-5） */
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
    onDismissKeyboard: onDismissKeyboard ?? defaultDismissKeyboard,
    onConfirmRequest: onConfirmRequest ?? defaultConfirmRequest,
    onTableSheetRequest
  })

  useEffect(() => {
    if (!active) bridge.blur()
  }, [active, bridge.blur])

  useEffect(() => {
    bridge.setScrollInsets(bottomScrollInset)
    if (bottomScrollInset > 0) {
      requestAnimationFrame(() => bridge.scrollCaretIntoView())
    }
  }, [bottomScrollInset, bridge.setScrollInsets, bridge.scrollCaretIntoView])

  useEffect(() => {
    if (keyboardInset <= 0) return
    const delayMs = Platform.OS === 'ios' ? 120 : 220
    const timer = setTimeout(() => bridge.scrollCaretIntoView(), delayMs)
    return () => clearTimeout(timer)
  }, [keyboardInset, bottomScrollInset, bridge.scrollCaretIntoView])

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
      bridge.deleteRange,
      bridge.focusAtOffset,
      bridge.insertAtCursor,
      bridge.insertAtRange,
      bridge.redo,
      bridge.toggleMarkdownMark,
      bridge.undo
    ]
  )

  const webViewRemountKey = editorWebViewSource.cacheKey ?? editorWebViewSource.uri

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

  const handleLoadStart = () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[DiaryEditor WebView] loadStart', editorWebViewSource.uri)
    }
    bridge.onWebViewLoadStart()
  }

  const handleLoadEnd = () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[DiaryEditor WebView] loadEnd')
    }
    bridge.onWebViewLoadEnd()
  }

  return (
    <View style={shellStyle} collapsable={false}>
      {active ? (
        <WebView
          key={webViewRemountKey}
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
          scrollEnabled={fillViewport}
          nestedScrollEnabled={fillViewport}
          overScrollMode="never"
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={bridge.onWebViewMessage}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
          onConsoleMessage={handleConsoleMessage}
          style={webViewStyle}
          containerStyle={webViewContainerStyle}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          {...(Platform.OS === 'ios'
            ? {
                allowingReadAccessToURL: editorWebViewSource.baseUrl,
                dataDetectorTypes: 'none' as const
              }
            : {})}
        />
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible'
  },
  webViewContainer: {
    width: '100%'
  },
  webView: {
    width: '100%'
  }
})
