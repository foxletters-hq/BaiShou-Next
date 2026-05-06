import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { DiaryEditor } from '@baishou/ui';
import { useBaishou } from '../../providers/BaishouProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { format } from 'date-fns';

export const DiaryEditorScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const { id, date, append } = useLocalSearchParams<{ id?: string; date?: string; append?: string }>();
  const router = useRouter();
  const { services, dbReady } = useBaishou();

  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weather, setWeather] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbReady || !services) return;
    
    const fetchDiary = async () => {
      try {
        if (id) {
          // 通过 id 查询日记
          const diary = await services.diaryService.findById(Number(id));
          if (diary) {
            setContent(diary.content);
            setOriginalContent(diary.content);
            setTags(typeof diary.tags === 'string' ? diary.tags.split(',') : (diary.tags || []));
            setSelectedDate(diary.date);
            setWeather(diary.weather || null);
            setIsFavorite(diary.isFavorite || false);
            setExistingId(diary.id);
          }
        } else if (date) {
          // 按日期查询已有日记
          const existing = await services.diaryService.findByDate(new Date(date));
          if (existing) {
            setExistingId(existing.id);
            setTags(typeof existing.tags === 'string' ? existing.tags.split(',') : (existing.tags || []));
            setSelectedDate(existing.date);
            setWeather(existing.weather || null);
            setIsFavorite(existing.isFavorite || false);
            
            // 如果是追加模式，保留原内容，在末尾追加
            if (append === '1') {
              const timeMark = `\n\n##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`;
              setContent(existing.content + timeMark);
              setOriginalContent(existing.content);
            } else {
              setContent(existing.content);
              setOriginalContent(existing.content);
            }
          } else {
            // 新建日记，设置初始时间标记
            const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`;
            setContent(timeMark);
            setSelectedDate(new Date(date));
          }
        } else {
          // 没有 id 和 date，新建日记
          const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`;
          setContent(timeMark);
        }
      } catch (e) {
        console.error('Failed to load diary:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDiary();
  }, [id, date, append, dbReady, services]);

  const handleSave = async () => {
    if (!services) return;
    
    try {
      const input = {
        content,
        tags: tags.join(','),
        date: selectedDate,
        weather: weather || undefined,
        isFavorite,
      };
      
      if (existingId) {
        // 追加模式下 content 已包含原内容+追加内容，直接保存
        await services.diaryService.update(existingId, input);
      } else {
        await services.diaryService.create(input);
      }
      router.back();
    } catch (e) {
      console.error('Failed to save diary:', e);
    }
  };

  if (loading) {
     return (
       <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
         <ActivityIndicator size="large" color={colors.accentGreen} />
       </View>
     );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        weather={weather || ''}
        isFavorite={isFavorite}
        onContentChange={setContent}
        onTagsChange={setTags}
        onDateChange={setSelectedDate}
        onWeatherChange={setWeather}
        onFavoriteChange={setIsFavorite}
        onSave={handleSave}
        onCancel={() => router.back()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 }
});
