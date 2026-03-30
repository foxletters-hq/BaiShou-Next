import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DiaryCard, TimelineNode } from '@baishou/ui';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryScreen: React.FC = () => {
  const { t } = useTranslation();

  const [diaries] = useState([
    {
      id: '1',
      contentSnippet: '今天的天气绝佳，阳光明媚。完成了早上的冥想和跑步，开始处理手头的 Agent 架构...',
      tags: ['日常', '工作', '冥想'],
      createdAt: new Date(),
    },
    {
      id: '2',
      contentSnippet: '复刻 BaiShou v3.0 的 UI 是一项庞大而精妙的工程，尤其是双端同时推进时的体验一致性考量。',
      tags: ['开发笔记', 'UI设计'],
      createdAt: new Date(Date.now() - 3600000),
    }
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('diary.title')}</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnText}>{t('diary.editor.new')}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.timelinePadding}>
        {diaries.map((diary, index) => (
          <TimelineNode key={diary.id} isLast={index === diaries.length - 1} isFirst={index === 0}>
            <DiaryCard 
              id={diary.id}
              contentSnippet={diary.contentSnippet}
              tags={diary.tags}
              createdAt={diary.createdAt}
              onClick={() => console.log('Open diary:', diary.id)}
            />
          </TimelineNode>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F8', // Mock var(--bg-app)
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48, // Safe area mock
    paddingBottom: 16,
    backgroundColor: '#FFFFFF', // Mock var(--bg-surface)
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A', // var(--text-primary)
  },
  addBtn: {
    backgroundColor: '#5BA8F5', // var(--color-primary)
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  timelinePadding: {
    padding: 16,
  }
});
