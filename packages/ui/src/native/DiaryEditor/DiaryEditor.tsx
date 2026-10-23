import { useTranslation } from 'react-i18next'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Keyboard,
  LayoutAnimation,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native'
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar'
import type { MarkdownToolbarToolId } from '../MarkdownToolbar/markdown-toolbar.types'
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
import { TableChromeBottomSheet } from './TableChromeBottomSheet'
import { DiaryEditorChrome } from './DiaryEditorChrome'
import { useDiaryEditorInsert } from './useDiaryEditorInsert'
import { useDiaryEditorTableSheet } from './useDiaryEditorTableSheet'
import { diaryEditorStyles as styles } from './diary-editor.styles'

interface DiaryEditorProps {
  content: string
  tags: string[]
  selectedDate: Date
  isSummaryMode?: boolean
  weather?: string
  mood?: string
  isFavorite?: boolean
  onContentChange: (content: string) => void
  onTagsChange: (tags: string[]) => void
  tagColorRegistry?: DiaryTagColorRegistry
  onDateChange: (date: Date) => void
  onWeatherChange?: (weather: string) => void
  onMoodChange?: (mood: string) => void
  onFavoriteChange?: (isFavorite: boolean) => void
  onSave?: (content: string, tags: string[], date: Date) => void
  onCancel?: () => void
  savePhase?: 'idle' | 'saving' | 'leaving'
  onPickImages?: () => Promise<string[]>
  pickingImages?: boolean
  editorWebViewSource: DiaryEditorWebViewDocument | null
  webViewActive?: boolean
  resolveAttachmentUrl?: (src: string) => Promise<string | null>
  markdownToolbarOrder?: MarkdownToolbarToolId[]
  onMarkdownToolbarOrderChange?: (order: MarkdownToolbarToolId[]) => void
  onReadAloud?: () => void
  isTtsPlaying?: boolean
}

/** 工具栏遮挡 + 额外留白，供 WebView 内计算安全滚动区域 */
const EDITOR_BOTTOM_SCROLL_INSET_BUFFER = 20

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  mood = '',
  isFavorite = false,
  onContentChange,
  onTagsChange: _onTagsChange,
  tagColorRegistry,
  onDateChange,
  onWeatherChange,
  onMoodChange,
  onFavoriteChange,
  onSave,
  onCancel,
  savePhase = 'idle',
  onPickImages,
  pickingImages = false,
  editorWebViewSource,
  webViewActive = true,
  resolveAttachmentUrl,
  markdownToolbarOrder,
  onMarkdownToolbarOrderChange,
  onReadAloud,
  isTtsPlaying = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(61)
  const editorRef = useRef<NativeDiaryCodeMirrorEditorHandle>(null)
  const keyboardInsetLockedRef = useRef(false)
  const toolbarInsertingRef = useRef(false)

  const { keyboardHeight, syncFromMetrics, resetKeyboard } = useKeyboardHeight({
    shouldIgnoreShow: () => keyboardInsetLockedRef.current,
    shouldIgnoreHide: () => toolbarInsertingRef.current,
    onHide: () => {
      keyboardInsetLockedRef.current = false
    }
  })

  useEffect(() => {
    resetKeyboard()
    return () => resetKeyboard()
  }, [resetKeyboard])

  const insert = useDiaryEditorInsert({
    content,
    editorRef,
    toolbarInsertingRef,
    syncFromMetrics
  })
  const tableSheet = useDiaryEditorTableSheet(keyboardInsetLockedRef)

  const handleUndo = useCallback(() => {
    insert.runEditorCommand(() => editorRef.current?.undo())
  }, [insert])

  const handleRedo = useCallback(() => {
    insert.runEditorCommand(() => editorRef.current?.redo())
  }, [insert])

  const handleToggleMark = useCallback(
    (marker: '**' | '*' | '`' | '~~') => {
      insert.runEditorCommand(() => editorRef.current?.toggleMarkdownMark(marker))
    },
    [insert]
  )

  const handlePickImages = async () => {
    if (!onPickImages) return
    const anchor = { ...insert.selectionRef.current }
    const markdowns = await onPickImages()
    if (!markdowns.length) return
    const block = (markdowns.length > 1 ? '\n\n' : '') + markdowns.join('\n\n') + '\n'
    insert.insertAtPosition(anchor.start, anchor.end, block)
  }

  const handleSelectionChange = useCallback(
    (start: number, end: number) => {
      if (toolbarInsertingRef.current) return
      insert.syncSelection({ start, end })
    },
    [insert]
  )

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
              editorRef.current?.deleteRange(payload.from, payload.to)
            }
          }
        ]
      )
    },
    [t]
  )

  const toolbarDockBottom = keyboardHeight
  const handleDismissEditorKeyboard = useCallback(() => {
    Keyboard.dismiss()
  }, [])
  const editorPlaceholder = t('diary.tag_editor_hint', '首行输入 #标签 后按回车，再写正文…')

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <DiaryEditorChrome
        colors={colors}
        isSummaryMode={isSummaryMode}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        savePhase={savePhase}
        weather={weather}
        mood={mood}
        isFavorite={isFavorite}
        content={content}
        isTtsPlaying={isTtsPlaying}
        onCancel={onCancel}
        onSave={() => onSave?.(content, tags, selectedDate)}
        onWeatherChange={onWeatherChange}
        onMoodChange={onMoodChange}
        onFavoriteChange={onFavoriteChange}
        onReadAloud={onReadAloud}
        snapKeyboardChromeAway={snapKeyboardChromeAway}
      />

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
              onDismissKeyboard={handleDismissEditorKeyboard}
              onTableSheetRequest={tableSheet.handleTableSheetRequest}
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

        {tableSheet.tableSheet ? (
          <TableChromeBottomSheet
            visible
            title={tableSheet.tableSheet.title}
            sections={tableSheet.tableSheet.sections}
            bottomOffset={toolbarDockBottom}
            onPick={(itemId) => void tableSheet.handleTableSheetPick(itemId)}
            onDismiss={tableSheet.closeTableSheet}
          />
        ) : null}

        <View
          style={[styles.toolbarDock, { bottom: toolbarDockBottom }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height
            if (h > 0 && h !== toolbarHeight) setToolbarHeight(h)
          }}
        >
          <MarkdownToolbar
            onInsertText={insert.handleInsertText}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onToggleMark={handleToggleMark}
            onPickImages={onPickImages ? handlePickImages : undefined}
            pickingImages={pickingImages}
            toolOrder={markdownToolbarOrder}
            onToolOrderChange={onMarkdownToolbarOrderChange}
          />
        </View>
      </View>

      <NativeImagePreviewModal uri={previewImageUri} onClose={() => setPreviewImageUri(null)} />
    </View>
  )
}
