import { useTranslation } from 'react-i18next'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  type TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar'
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle'
import { TagInput } from '../TagInput/TagInput'
import { WeatherPicker } from '../WeatherPicker/WeatherPicker'
import { useNativeTheme } from '../theme'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { Input } from '../Input/Input'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import { NativeImagePreviewModal } from './NativeImagePreviewModal'
import type { DiaryEditorViewMode } from './diary-editor.types'
import {
  adjustImageWidthInContent,
  DIARY_IMAGE_SIZE,
  findImageAtOffset,
  type ParsedDiaryImage
} from './diary-image-markdown.util'

interface DiaryEditorProps {
  content: string
  tags: string[]
  selectedDate: Date
  isSummaryMode?: boolean
  weather?: string
  isFavorite?: boolean
  onContentChange: (content: string) => void
  onTagsChange: (tags: string[]) => void
  onDateChange: (date: Date) => void
  onWeatherChange?: (weather: string) => void
  onFavoriteChange?: (isFavorite: boolean) => void
  onSave?: (content: string, tags: string[], date: Date) => void
  onCancel?: () => void
  /** 从相册选取并上传图片，返回要插入的 Markdown 片段 */
  onPickImages?: () => Promise<string[]>
  pickingImages?: boolean
  /** attachment/xxx → file:// 本地路径 */
  resolveAttachmentUri?: (src: string) => string | null | undefined
}

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  isFavorite = false,
  onContentChange,
  onTagsChange,
  onDateChange,
  onWeatherChange,
  onFavoriteChange,
  onSave,
  onCancel,
  onPickImages,
  pickingImages = false,
  resolveAttachmentUri
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [viewMode, setViewMode] = useState<DiaryEditorViewMode>('edit')
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [editorHeight, setEditorHeight] = useState(200)
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState<ParsedDiaryImage | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(52)
  const textInputRef = useRef<RNTextInput>(null)
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
    setSelection(sel)
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
        textInputRef.current?.focus()
        textInputRef.current?.setNativeProps?.({ selection: sel })
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
      const newText = current.substring(0, safeStart) + snippet + current.substring(safeEnd)
      const cursor = safeStart + snippet.length
      const sel = { start: cursor, end: cursor }
      toolbarInsertingRef.current = true
      pendingSelectionRef.current = sel
      onContentChange(newText)
      syncSelection(sel)
      refocusEditor(sel)
      requestAnimationFrame(() => {
        toolbarInsertingRef.current = false
      })
    },
    [onContentChange, syncSelection, refocusEditor]
  )

  const insertAtSelection = useCallback(
    (snippet: string) => {
      const { start, end } = selectionRef.current
      insertAtPosition(start, end, snippet)
    },
    [insertAtPosition]
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

  const updateActiveImageFromSelection = useCallback((offset: number) => {
    const img = findImageAtOffset(contentRef.current, offset)
    setActiveImage(img)
  }, [])

  const handleSelectionChange = useCallback(
    (start: number, end: number) => {
      if (toolbarInsertingRef.current) return
      syncSelection({ start, end })
      updateActiveImageFromSelection(end)
    },
    [syncSelection, updateActiveImageFromSelection]
  )

  useEffect(() => {
    if (pendingSelectionRef.current) {
      const sel = pendingSelectionRef.current
      pendingSelectionRef.current = null
      syncSelection(sel)
      updateActiveImageFromSelection(sel.end)
    }
  }, [content, syncSelection, updateActiveImageFromSelection])

  useEffect(() => {
    if (viewMode === 'edit') {
      updateActiveImageFromSelection(selectionRef.current.end)
    }
  }, [viewMode, updateActiveImageFromSelection])

  const snapKeyboardChromeAway = useCallback(() => {
    keyboardInsetLockedRef.current = true
    LayoutAnimation.configureNext(
      LayoutAnimation.create(0, LayoutAnimation.Types.linear, 'opacity')
    )
    resetKeyboard()
    textInputRef.current?.blur()
    Keyboard.dismiss()
  }, [resetKeyboard])

  const handleImageWidthDelta = useCallback(
    (delta: number) => {
      const img = activeImage ?? findImageAtOffset(contentRef.current, selectionRef.current.end)
      if (!img) return
      const next = adjustImageWidthInContent(contentRef.current, img, delta)
      onContentChange(next)
      const updated = findImageAtOffset(next, img.from)
      if (updated) {
        syncSelection({ start: updated.to, end: updated.to })
        setActiveImage(updated)
      }
    },
    [activeImage, onContentChange, syncSelection]
  )

  const handlePreviewImagePress = useCallback(
    (src: string, resolvedUri: string) => {
      setPreviewImageUri(resolvedUri)
      const idx = contentRef.current.indexOf(src)
      if (idx < 0) return
      const img = findImageAtOffset(contentRef.current, idx)
      if (img) {
        syncSelection({ start: img.from, end: img.to })
        setActiveImage(img)
      }
    },
    [syncSelection]
  )

  const handleSwitchToEdit = useCallback(() => {
    setViewMode('edit')
    requestAnimationFrame(() => {
      textInputRef.current?.focus()
      const sel = selectionRef.current
      textInputRef.current?.setNativeProps?.({ selection: sel })
      updateActiveImageFromSelection(sel.end)
    })
  }, [updateActiveImageFromSelection])

  const resolveImageUri = useMemo(() => {
    if (!resolveAttachmentUri) return undefined
    return (src: string) => resolveAttachmentUri(src) ?? src
  }, [resolveAttachmentUri])

  const showImageTools = viewMode === 'edit' && activeImage != null

  // Modal 等场景下 Android 往往不会 adjustResize，需用键盘高度把工具栏钉在输入法上方
  const toolbarBottom = keyboardHeight

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

      <View style={styles.editorBody}>
        <ScrollView
          style={styles.body}
          nestedScrollEnabled
          contentContainerStyle={[
            styles.bodyContent,
            styles.bodyContentGrow,
            { paddingBottom: toolbarBottom + 16 }
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editorMain}>
            {!isSummaryMode && viewMode === 'edit' && (
              <View style={styles.tagsSection}>
                <TagInput tags={tags} onChange={onTagsChange} />
              </View>
            )}

            {!isSummaryMode && onWeatherChange && viewMode === 'edit' && (
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

            {viewMode === 'edit' ? (
              <Input
                ref={textInputRef}
                style={[styles.textArea, { minHeight: Math.max(280, editorHeight) }]}
                multiline
                textarea
                placeholder={t('diary.editor_hint')}
                value={content}
                selection={selection}
                onChangeText={onContentChange}
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent.contentSize.height
                  if (h > 0) setEditorHeight(h)
                }}
                onSelectionChange={(e) => {
                  const { start, end } = e.nativeEvent.selection
                  handleSelectionChange(start, end)
                }}
                onFocus={() => {
                  keyboardInsetLockedRef.current = false
                  updateActiveImageFromSelection(selectionRef.current.end)
                  if (Platform.OS === 'android') {
                    requestAnimationFrame(syncFromMetrics)
                  }
                }}
              />
            ) : (
              <Pressable onPress={handleSwitchToEdit} style={styles.previewArea}>
                <MarkdownRenderer
                  content={content}
                  resolveImageUri={resolveImageUri}
                  onImagePress={handlePreviewImagePress}
                />
              </Pressable>
            )}
          </View>

          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height
              if (h > 0 && h !== toolbarHeight) setToolbarHeight(h)
            }}
          >
            <MarkdownToolbar
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                if (mode === 'edit') handleSwitchToEdit()
                else setViewMode('preview')
              }}
              onHideKeyboard={snapKeyboardChromeAway}
              onInsertText={handleInsertText}
              onPickImages={onPickImages ? handlePickImages : undefined}
              pickingImages={pickingImages}
              showImageTools={showImageTools}
              onImageZoomIn={() => handleImageWidthDelta(DIARY_IMAGE_SIZE.step)}
              onImageZoomOut={() => handleImageWidthDelta(-DIARY_IMAGE_SIZE.step)}
            />
          </View>
        </ScrollView>
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
  editorBody: {
    flex: 1,
    position: 'relative'
  },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  bodyContentGrow: { flexGrow: 1 },
  editorMain: { flexGrow: 1 },
  tagsSection: {
    marginBottom: 12
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
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
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top'
  },
  previewArea: { minHeight: 280, paddingBottom: 16 }
})
