import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import type { DiaryCmTheme } from '../../shared/diary-codemirror/types'
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
}

export interface NativeDiaryCodeMirrorEditorHandle {
  focusAtOffset: (offset: number) => void
  blur: () => void
  insertAtCursor: (text: string) => void
  insertAtRange: (start: number, end: number, text: string) => void
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
    bottomScrollInset
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
      insertAtRange: bridge.insertAtRange
    }),
    [bridge.blur, bridge.focusAtOffset, bridge.insertAtCursor, bridge.insertAtRange]
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
          key={editorWebViewSource.uri}
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
          {...(Platform.OS === 'android'
            ? ({ onConsoleMessage: handleConsoleMessage } as Record<string, unknown>)
            : {})}
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
