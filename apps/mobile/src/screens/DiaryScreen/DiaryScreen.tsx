import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { DiaryCard, TimelineNode } from '@baishou/ui';
import { useBaishou } from '../../providers/BaishouProvider';
import { useRouter } from 'expo-router';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [diaries, setDiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiaries = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const list = await services.diaryService.listAll({ limit: 50 });
      setDiaries(list);
    } catch (e) {
      console.error('Failed to fetch diaries', e);
    } finally {
      setLoading(false);
    }
  }, [dbReady, services]);

  useEffect(() => {
    fetchDiaries();
  }, [fetchDiaries]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>记忆节点</Text>
              <Text style={styles.headerSubtitle}>NEURAL SNAPSHOTS (B8.1)</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/diary-editor')}>
              <Text style={styles.addBtnIcon}>✍️</Text>
              <Text style={styles.addBtnText}>刻录新痕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.contentContainer} contentContainerStyle={styles.timelinePadding} indicatorStyle="white">
            {loading ? (
               <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
            ) : diaries.length === 0 ? (
               <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.5 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🌌</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 16 }}>记忆荒原，一无所有</Text>
               </View>
            ) : (
              diaries.map((diary, index) => (
                <TimelineNode key={diary.id} isLast={index === diaries.length - 1} isFirst={index === 0}>
                  {/* 借用原版 Web/通用层组件，此处外部包裹调整层提供一点深色感 */}
                  <View style={styles.cardWrapper}>
                    <DiaryCard 
                      id={diary.id}
                      contentSnippet={diary.preview || diary.contentSnippet || '暂无预览...'}
                      tags={diary.tags || []}
                      createdAt={diary.date || diary.createdAt}
                      onClick={() => router.push(`/(tabs)/diary-editor?id=${diary.id}`)}
                    />
                    {/* 叠加光晕掩码进行降噪隔离 */}
                    <View style={styles.glassMask} pointerEvents="none" />
                  </View>
                </TimelineNode>
              ))
            )}
            
            <View style={styles.footerMarker}>
               <Text style={styles.footerMarkerText}>=== 已触达此神经链路的底层 ===</Text>
            </View>
          </ScrollView>

        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0E14', 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#0F131A', 
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF', 
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
    letterSpacing: 1.2
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 168, 245, 0.15)', 
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 245, 0.3)',
    gap: 6
  },
  addBtnIcon: {
    fontSize: 14,
  },
  addBtnText: {
    color: '#5BA8F5',
    fontWeight: '800',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
  },
  timelinePadding: {
    padding: 24,
    paddingBottom: 40
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  glassMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 14, 20, 0.03)', // 微调减弱内部子组件可能透出的刺眼白光
    borderRadius: 12
  },
  footerMarker: {
    alignItems: 'center',
    paddingVertical: 32,
    opacity: 0.3
  },
  footerMarkerText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2
  }
});
