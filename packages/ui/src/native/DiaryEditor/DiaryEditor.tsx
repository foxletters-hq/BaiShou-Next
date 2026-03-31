import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
// import { TagInput } from '../TagInput';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onSave?: (content: string, tags: string[], date: Date) => void;
  onCancel?: () => void;
}

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  onContentChange,
  onTagsChange,
  onDateChange,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isPreview, setIsPreview] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);

  const handleInsertText = (prefix: string, suffix: string = '') => {
    const val = content;
    const start = selection.start;
    const end = selection.end;
    const selectedText = val.substring(start, end);
    
    const newText = val.substring(0, start) + prefix + selectedText + suffix + val.substring(end);
    onContentChange(newText);
    
    setTimeout(() => {
       textInputRef.current?.focus();
    }, 100);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
           <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.appBarCenter}>
           <DiaryEditorAppBarTitle 
             isSummaryMode={isSummaryMode}
             selectedDate={selectedDate}
             onDateChanged={onDateChange}
           />
        </View>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={() => onSave?.(content, tags, selectedDate)}
        >
           <Text style={styles.saveBtnText}>{t('common.save') || '保存'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {!isSummaryMode && (
          <View style={styles.tagsSection}>
            {/* <TagInput tags={tags} onChange={onTagsChange} /> */}
          </View>
        )}

        {!isPreview ? (
          <TextInput
             ref={textInputRef}
             style={styles.textArea}
             multiline
             placeholder={t('diary.editor_hint') || '记录下这一刻...'}
             placeholderTextColor="#94A3B8"
             value={content}
             onChangeText={onContentChange}
             onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          />
        ) : (
          <View style={styles.previewArea}>
             <Text style={{ color: '#1A1A1A' }}>{content}</Text>
          </View>
        )}
      </ScrollView>

      <MarkdownToolbar 
        isPreview={isPreview}
        onTogglePreview={() => setIsPreview(!isPreview)}
        onHideKeyboard={() => textInputRef.current?.blur()}
        onInsertText={handleInsertText}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.2)'
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 24, color: '#1A1A1A' },
  appBarCenter: { flex: 1, alignItems: 'center' },
  saveBtn: { backgroundColor: '#5BA8F5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  body: { flex: 1 },
  bodyContent: { padding: 24 },
  tagsSection: { marginBottom: 16 },
  textArea: { fontSize: 16, lineHeight: 24, color: '#1A1A1A', minHeight: 300, textAlignVertical: 'top' },
  previewArea: { minHeight: 300 }
});
