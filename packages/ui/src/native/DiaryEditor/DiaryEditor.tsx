import { useTranslation } from 'react-i18next'
import React, { useState, useRef } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar'
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle'
import { WeatherPicker } from '../WeatherPicker/WeatherPicker'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import type { DiaryEditorViewMode } from './diary-editor.types'

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
  pickingImages = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [viewMode, setViewMode] = useState<DiaryEditorViewMode>('edit')
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [editorHeight, setEditorHeight] = useState(200)
  const textInputRef = useRef<TextInput>(null)

  const insertAtSelection = (snippet: string) => {
    const start = selection.start
    const end = selection.end
    const newText = content.substring(0, start) + snippet + content.substring(end)
    onContentChange(newText)
    const cursor = start + snippet.length
    setSelection({ start: cursor, end: cursor })
    setTimeout(() => textInputRef.current?.focus(), 100)
  }

  const handleInsertText = (prefix: string, suffix: string = '') => {
    const start = selection.start
    const end = selection.end
    const selectedText = content.substring(start, end)
    insertAtSelection(prefix + selectedText + suffix)
  }

  const handlePickImages = async () => {
    if (!onPickImages) return
    const markdowns = await onPickImages()
    if (!markdowns.length) return
    const block = (markdowns.length > 1 ? '\n\n' : '') + markdowns.join('\n\n') + '\n'
    insertAtSelection(block)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgSurface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
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
          onPress={() => onSave?.(content, tags, selectedDate)}
        >
          <Text style={[styles.saveBtnText, { color: colors.textOnPrimary }]}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
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
          <TextInput
            ref={textInputRef}
            style={[
              styles.textArea,
              { color: colors.textPrimary, minHeight: Math.max(280, editorHeight) }
            ]}
            multiline
            scrollEnabled={false}
            placeholder={t('diary.editor_hint')}
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={onContentChange}
            onContentSizeChange={(e) => {
              const h = e.nativeEvent.contentSize.height
              if (h > 0) setEditorHeight(h)
            }}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          />
        ) : (
          <View style={styles.previewArea}>
            <MarkdownRenderer content={content} />
          </View>
        )}
      </ScrollView>

      <MarkdownToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onHideKeyboard={() => textInputRef.current?.blur()}
        onInsertText={handleInsertText}
        onPickImages={onPickImages ? handlePickImages : undefined}
        pickingImages={pickingImages}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontWeight: '600', fontSize: 14 },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },
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
