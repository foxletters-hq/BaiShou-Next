import { useTranslation } from 'react-i18next'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar'
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle'
import { WeatherPicker } from '../WeatherPicker/WeatherPicker'
import { useNativeTheme } from '../theme'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import {
  NativeDiaryCodeMirrorEditor,
  type NativeDiaryCodeMirrorEditorHandle,
  type DiaryEditorWebViewDocument
} from './NativeDiaryCodeMirrorEditor'
import { NativeImagePreviewModal } from './NativeImagePreviewModal'
import type {
  DiaryTagColorRegistry,
  DiaryCmImageActionPayload
} from '../../shared/diary-codemirror/types'
import { deleteMarkdownRange } from './diary-cm-content.util'

interface DiaryEditorProps {
  content: string
  tags: string[]
  selectedDate: Date
  isSummaryMode?: boolean
  weather?: string
  isFavorite?: boolean
  onContentChange: (content: string) => void
  onTagsChange: (tags: string[]) => void
  tagColorRegistry?: DiaryTagColorRegistry
  onDateChange: (date: Date) => void
  onWeatherChange?: (weather: string) => void
  onFavoriteChange?: (isFavorite: boolean) => void
  onSave?: (content: string, tags: string[], date: Date) => void
  onCancel?: () => void
  /** 从相册选取并上传图片，返回要插入的 Markdown 片段 */
  onPickImages?: () => Promise<string[]>
  pickingImages?: boolean
  /** WebView 文档（由宿主 app 预加载后传入） */
  editorWebViewSource: DiaryEditorWebViewDocument | null
  /** WebView 页面是否处于聚焦态（离开页面时卸载 WebView，P-5） */
  webViewActive?: boolean
  /** attachment/xxx → data: 或 file: URI（异步桥接） */
  resolveAttachmentUrl?: (src: string) => Promise<string | null>
}

/** 工具栏遮挡 + 额外留白，供 WebView 内计算安全滚动区域 */
const EDITOR_BOTTOM_SCROLL_INSET_BUFFER = 20

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  isFavorite = false,
  onContentChange,
  onTagsChange: _onTagsChange,
  tagColorRegistry,
  onDateChange,
  onWeatherChange,
  onFavoriteChange,
  onSave,
  onCancel,
  onPickImages,
  pickingImages = false,
  editorWebViewSource,
  webViewActive = true,
  resolveAttachmentUrl
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(61)
  const editorRef = useRef<NativeDiaryCodeMirrorEditorHandle>(null)
  const keyboardInsetLockedRef = useRef(false)
  const contentRef = useRef(content)
  const selectionRef = useRef({ start: 0, end: 0 })
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const toolbarInsertingRef = useRef(false)

  const { keyboardHeight, syncFromMetrics, resetKeyboard } = useKeyboardHeight({
    shouldIgnoreShow: () => keyboardInsetLockedRef.current,
    shouldIgnoreHide: () => toolbarInsertingRef.current,
    onHide: () => {
      keyboardInsetLockedRef.current = false
    }
  })

  contentRef.current = content

  const syncSelection = useCallback((sel: { start: number; end: number }) => {
    selectionRef.current = sel
  }, [])

  const prevContentLenRef = useRef(0)
  useEffect(() => {
    const grew = content.length > prevContentLenRef.current
    prevContentLenRef.current = content.length
    if (toolbarInsertingRef.current) return
    if (
      grew &&
      content.length > 0 &&
      selectionRef.current.start === 0 &&
      selectionRef.current.end === 0
    ) {
      syncSelection({ start: content.length, end: content.length })
    }
  }, [content, syncSelection])

  const refocusEditor = useCallback(
    (sel: { start: number; end: number }) => {
      requestAnimationFrame(() => {
        editorRef.current?.focusAtOffset(sel.start)
        if (Platform.OS === 'android') {
          requestAnimationFrame(syncFromMetrics)
        }
      })
    },
    [syncFromMetrics]
  )

  const insertAtPosition = useCallback(
    (start: number, end: number, snippet: string) => {
      const current = contentRef.current
      const safeStart = Math.max(0, Math.min(start, current.length))
      const safeEnd = Math.max(safeStart, Math.min(end, current.length))
      const cursor = safeStart + snippet.length
      const sel = { start: cursor, end: cursor }

      toolbarInsertingRef.current = true
      pendingSelectionRef.current = sel
      editorRef.current?.insertAtRange(safeStart, safeEnd, snippet)
      syncSelection(sel)
      refocusEditor(sel)
      requestAnimationFrame(() => {
        toolbarInsertingRef.current = false
      })
    },
    [syncSelection, refocusEditor]
  )

  const handleInsertText = useCallback(
    (prefix: string, suffix: string = '') => {
      const { start, end } = selectionRef.current
      const current = contentRef.current
      const selectedText = current.substring(start, end)
      insertAtPosition(start, end, prefix + selectedText + suffix)
    },
    [insertAtPosition]
  )

  const handlePickImages = async () => {
    if (!onPickImages) return
    const anchor = { ...selectionRef.current }
    const markdowns = await onPickImages()
    if (!markdowns.length) return
    const block = (markdowns.length > 1 ? '\n\n' : '') + markdowns.join('\n\n') + '\n'
    insertAtPosition(anchor.start, anchor.end, block)
  }

  const handleSelectionChange = useCallback(
    (start: number, end: number) => {
      if (toolbarInsertingRef.current) return
      syncSelection({ start, end })
    },
    [syncSelection]
  )

  useEffect(() => {
    if (pendingSelectionRef.current) {
      const sel = pendingSelectionRef.current
      pendingSelectionRef.current = null
      syncSelection(sel)
    }
  }, [content, syncSelection])

  const snapKeyboardChromeAway = useCallback(() => {
    keyboardInsetLockedRef.current = true
    LayoutAnimation.configureNext(
      LayoutAnimation.create(0, LayoutAnimation.Types.linear, 'opacity')
    )
    resetKeyboard()
    editorRef.current?.blur()
    Keyboard.dismiss()
  }, [resetKeyboard])

  const handleImagePreview = useCallback((_srcRaw: string, resolvedUrl: string) => {
    setPreviewImageUri(resolvedUrl)
  }, [])

  const handleImageAction = useCallback(
    (payload: DiaryCmImageActionPayload) => {
      if (payload.action !== 'delete') return
      Alert.alert(
        t('common.confirm', '确认'),
        t('diary.delete_image_confirm', '确定删除这张图片吗？'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.delete', '删除'),
            style: 'destructive',
            onPress: () => {
              onContentChange(deleteMarkdownRange(contentRef.current, payload.from, payload.to))
            }
          }
        ]
      )
    },
    [onContentChange, t]
  )

  const toolbarDockBottom = keyboardHeight
  const editorPlaceholder = t('diary.tag_editor_hint', '首行输入 #标签 后按回车，再写正文…')

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            snapKeyboardChromeAway()
            onCancel?.()
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.appBarCenter}>
          <DiaryEditorAppBarTitle
            isSummaryMode={isSummaryMode}
            selectedDate={selectedDate}
            onDateChanged={onDateChange}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            snapKeyboardChromeAway()
            onSave?.(content, tags, selectedDate)
          }}
        >
          <Text style={[styles.saveBtnText, { color: colors.textOnPrimary }]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>

      {!isSummaryMode && onWeatherChange && (
        <View style={[styles.metaBar, { borderBottomColor: colors.borderSubtle }]}>
          <WeatherPicker value={weather} onChange={onWeatherChange} />
          <Pressable
            style={({ pressed }) => [
              styles.favBtn,
              {
                opacity: pressed ? 0.85 : 1,
                backgroundColor: isFavorite ? colors.primaryLight : colors.bgSurface,
                borderColor: isFavorite ? colors.warning : colors.borderSubtle
              }
            ]}
            onPress={() => onFavoriteChange?.(!isFavorite)}
            accessibilityLabel={isFavorite ? t('diary.unfavorite') : t('diary.favorite')}
          >
            <MaterialIcons
              name={isFavorite ? 'favorite' : 'favorite-border'}
              size={20}
              color={isFavorite ? colors.warning : colors.textTertiary}
            />
          </Pressable>
        </View>
      )}

      <View style={styles.editorBody}>
        <View style={styles.editorPane}>
          {editorWebViewSource ? (
            <NativeDiaryCodeMirrorEditor
              ref={editorRef}
              editorWebViewSource={editorWebViewSource}
              active={webViewActive}
              content={content}
              editable
              placeholder={editorPlaceholder}
              onChange={onContentChange}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                keyboardInsetLockedRef.current = false
                if (Platform.OS === 'android') {
                  requestAnimationFrame(syncFromMetrics)
                }
              }}
              onImagePreview={handleImagePreview}
              onImageAction={handleImageAction}
              resolveAttachmentUrl={resolveAttachmentUrl}
              tagColorRegistry={tagColorRegistry}
              keyboardInset={keyboardHeight}
              bottomScrollInset={toolbarHeight + EDITOR_BOTTOM_SCROLL_INSET_BUFFER}
              fillViewport
              style={styles.editorFill}
            />
          ) : (
            <View style={styles.editorLoadFallback}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.editorLoadHint, { color: colors.textSecondary }]}>
                {t('diary.editor_webview_loading', '正在加载编辑器…')}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[styles.toolbarDock, { bottom: toolbarDockBottom }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height
            if (h > 0 && h !== toolbarHeight) setToolbarHeight(h)
          }}
        >
          <MarkdownToolbar
            onInsertText={handleInsertText}
            onPickImages={onPickImages ? handlePickImages : undefined}
            pickingImages={pickingImages}
          />
        </View>
      </View>

      <NativeImagePreviewModal uri={previewImageUri} onClose={() => setPreviewImageUri(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontWeight: '600', fontSize: 14 },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  editorBody: {
    flex: 1,
    position: 'relative'
  },
  editorPane: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8
  },
  editorFill: {
    flex: 1
  },
  toolbarDock: {
    position: 'absolute',
    left: 0,
    right: 0
  },
  editorLoadFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48
  },
  editorLoadHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24
  }
})
