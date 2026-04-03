import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { DiaryEditor } from '@baishou/ui';
import { useBaishou } from '../../providers/BaishouProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';

export const DiaryEditorScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { services, dbReady } = useBaishou();

  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!dbReady || !services || !id) return;
    const fetchDiary = async () => {
      try {
        const diary = await services.diaryService.findById(Number(id));
        if (diary) {
          setContent(diary.content);
          setTags(typeof diary.tags === 'string' ? diary.tags.split(',') : (diary.tags || []));
          setSelectedDate(diary.date);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDiary();
  }, [id, dbReady, services]);

  const handleSave = async () => {
    if (!services) return;
    const input = {
      content,
      tags: tags.join(','),
      date: selectedDate,
    };
    try {
      if (id) {
        await services.diaryService.update(Number(id), input);
      } else {
        await services.diaryService.create(input);
      }
      router.back();
    } catch (e) {
      console.error('Failed to save diary:', e);
      alert('保存失败，请检查是否重叠或日期冲突。');
    }
  };

  if (loading) {
     return (
       <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
         <ActivityIndicator size="large" color="#10B981" />
       </View>
     );
  }

  return (
    <View style={styles.container}>
      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={setContent}
        onTagsChange={setTags}
        onDateChange={setSelectedDate}
        onSave={handleSave}
        onCancel={() => router.back()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }
});
