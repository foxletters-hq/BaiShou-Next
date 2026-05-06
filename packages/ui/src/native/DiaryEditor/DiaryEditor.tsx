import { useTranslation } from 'react-i18next';
import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { useNativeTheme } from '../theme';
// import { TagInput } from '../TagInput';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  weather?: string;
  isFavorite?: boolean;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onWeatherChange?: (weather: string) => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  onSave?: (content: string, tags: string[], date: Date) => void;
  onCancel?: () => void;
}

const WEATHER_OPTIONS = [
  { value: '', icon: '🌡️' },
  { value: 'sunny', icon: '☀️' },
  { value: 'cloudy', icon: '⛅' },
  { value: 'overcast', icon: '☁️' },
  { value: 'light_rain', icon: '🌦️' },
  { value: 'heavy_rain', icon: '🌧️' },
  { value: 'snow', icon: '❄️' },
  { value: 'fog', icon: '🌫️' },
  { value: 'windy', icon: '💨' },
];

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
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
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
      style={[styles.container, { backgroundColor: colors.bgSurface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.appBar, { borderBottomColor: colors.textSecondary + '33' }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
           <Text style={[styles.iconText, { color: colors.textPrimary }]}>←</Text>
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
           <Text style={[styles.saveBtnText, { color: colors.bgSurface }]}>{t('common.save', '保存')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {!isSummaryMode && (
          <View style={styles.tagsSection}>
            {/* <TagInput tags={tags} onChange={onTagsChange} /> */}
          </View>
        )}

        {/* 元数据栏：天气、收藏 */}
        {!isSummaryMode && (
          <View style={[styles.metaBar, { borderBottomColor: colors.textSecondary + '20' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weatherScroll}>
              {WEATHER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.weatherChip,
                    {
                      backgroundColor: weather === opt.value ? colors.primary + '20' : colors.bgSurfaceHighest,
                      borderColor: weather === opt.value ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => onWeatherChange?.(opt.value === weather ? '' : opt.value)}
                >
                  <Text style={styles.weatherIcon}>{opt.icon}</Text>
                  {opt.value && (
                    <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                      {t(`diary.weather.${opt.value}`, opt.value)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.favBtn,
                { backgroundColor: isFavorite ? colors.primary + '20' : colors.bgSurfaceHighest },
              ]}
              onPress={() => onFavoriteChange?.(!isFavorite)}
            >
              <Text style={styles.favIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isPreview ? (
          <TextInput
             ref={textInputRef}
             style={[styles.textArea, { color: colors.textPrimary }]}
             multiline
             placeholder={t('diary.editor_hint', '记录下这一刻...')}
             placeholderTextColor={colors.textSecondary}
             value={content}
             onChangeText={onContentChange}
             onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          />
        ) : (
          <View style={styles.previewArea}>
             <Text style={{ color: colors.textPrimary }}>{content}</Text>
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
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 24 },
  appBarCenter: { flex: 1, alignItems: 'center' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontWeight: 'bold', fontSize: 14 },
  body: { flex: 1 },
  bodyContent: { padding: 24 },
  tagsSection: { marginBottom: 16 },
  metaBar: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    paddingBottom: 12, borderBottomWidth: 1
  },
  weatherScroll: { flex: 1 },
  weatherChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1
  },
  weatherIcon: { fontSize: 16 },
  weatherLabel: { fontSize: 12, marginLeft: 4 },
  favBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  favIcon: { fontSize: 18 },
  textArea: { fontSize: 16, lineHeight: 24, minHeight: 300, textAlignVertical: 'top' },
  previewArea: { minHeight: 300 }
});
