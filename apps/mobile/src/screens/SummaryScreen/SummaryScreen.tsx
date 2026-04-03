import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { 
  SummaryCard, DashboardHeroBanner, 
  DashboardStatsCard, DashboardSharedMemoryCard 
} from '@baishou/ui';
import { useBaishou } from '../../providers/BaishouProvider';

export const SummaryScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const { services, dbReady } = useBaishou();

  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel');
  const [lookbackMonths, setLookbackMonths] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalDiaryCount: 0,
    totalWeeklyCount: 0,
    totalMonthlyCount: 0,
    totalQuarterlyCount: 0,
    totalYearlyCount: 0,
  });

  const [summaries, setSummaries] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const [sumList, diaryCount] = await Promise.all([
        services.summaryManager.list(),
        services.diaryService.count()
      ]);
      
      setSummaries(sumList.map(s => ({
         id: String(s.id),
         title: `${s.type === 'weekly' ? '周' : s.type === 'monthly' ? '月' : '度'}复盘`,
         dateRange: `${new Date(s.startDate).toISOString().split('T')[0]} - ${new Date(s.endDate).toISOString().split('T')[0]}`,
         type: s.type,
         summaryText: s.content.substring(0, 100) + '...'
      })));

      setStats({
        totalDiaryCount: diaryCount,
        totalWeeklyCount: sumList.filter(s => s.type === 'weekly').length,
        totalMonthlyCount: sumList.filter(s => s.type === 'monthly').length,
        totalQuarterlyCount: sumList.filter(s => s.type === 'quarterly').length,
        totalYearlyCount: sumList.filter(s => s.type === 'yearly').length,
      });

    } catch (e) {
      console.warn('Failed to load summary stats', e);
    } finally {
      setLoading(false);
    }
  }, [dbReady, services]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const isWide = width > 600;

  const handleCopyContext = () => {
     // TODO: 结合 AgentService 提供真实导出逻辑，待后续 Phase 补完
     console.log('Copy context mock: to be implemented via FileSync');
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          
          <View style={styles.header}>
            <View style={styles.headerTopLine}>
              <View>
                 <Text style={styles.superTitle}>算力演算场</Text>
                 <Text style={styles.subTitle}>DATA MATRIX (B8.4)</Text>
              </View>
              <TouchableOpacity style={styles.settingsBtn}>
                <Text style={styles.settingsIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity onPress={() => setActiveTab('panel')} style={[styles.tab, activeTab === 'panel' && styles.tabActive]}>
                <Text style={[styles.tabText, activeTab === 'panel' && styles.tabTextActive]}>大盘脉冲</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('gallery')} style={[styles.tab, activeTab === 'gallery' && styles.tabActive]}>
                <Text style={[styles.tabText, activeTab === 'gallery' && styles.tabTextActive]}>碎片画廊</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'panel' ? (
            <ScrollView contentContainerStyle={styles.panelContent} indicatorStyle="white">
              <View style={styles.moduleWrapper}>
                 <DashboardHeroBanner />
              </View>
              <View style={isWide ? styles.wideLayout : styles.narrowLayout}>
                <View style={[styles.moduleWrapper, { flex: 1 }]}>
                  <DashboardSharedMemoryCard 
                    lookbackMonths={lookbackMonths}
                    onMonthsChanged={setLookbackMonths}
                    onCopyContext={handleCopyContext}
                  />
                </View>
                <View style={[styles.moduleWrapper, { flex: 1 }]}>
                  <DashboardStatsCard {...stats} />
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.galleryContent}>
              <View style={styles.galleryActions}>
                  <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, viewMode === 'list' && styles.toggleBtnTextActive]}>☵</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode('grid')} style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, viewMode === 'grid' && styles.toggleBtnTextActive]}>☷</Text>
                  </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.scrollItems} indicatorStyle="white">
                {loading ? (
                  <ActivityIndicator size="large" color="#AD88D4" style={{ marginTop: 40 }} />
                ) : summaries.length === 0 ? (
                   <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                      <Text style={{ fontSize: 32, marginBottom: 12 }}>🕸️</Text>
                      <Text style={{ color: '#94A3B8', fontSize: 15 }}>无聚合数据产生</Text>
                   </View>
                ) : (
                  summaries.map(item => (
                    <View key={item.id} style={styles.cardContainer}>
                      <SummaryCard 
                        id={item.id}
                        title={item.title}
                        dateRange={item.dateRange}
                        summaryText={item.summaryText}
                        type={item.type}
                        onClick={() => console.log('HyperJump to:', item.id)}
                      />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0E14' },
  container: { flex: 1, backgroundColor: '#0B0E14' },
  header: {
    backgroundColor: '#0F131A', 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTopLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8
  },
  superTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  subTitle: { fontSize: 10, fontWeight: '700', color: '#AD88D4', marginTop: 2, letterSpacing: 1.2 },
  settingsBtn: { 
    padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  settingsIcon: { fontSize: 16 },
  
  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: 24, marginTop: 8 },
  tab: { paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#5BA8F5' },
  tabText: { fontSize: 15, color: '#64748B', fontWeight: '700' },
  tabTextActive: { color: '#5BA8F5', fontWeight: '900', textShadowColor: 'rgba(91, 168, 245, 0.4)', textShadowRadius: 8, textShadowOffset: {width: 0, height: 0} },
  
  panelContent: { padding: 20, gap: 24, paddingBottom: 40 },
  moduleWrapper: {
    opacity: 0.95, // 制造一种微微融入背景深色的错觉
  },
  wideLayout: { flexDirection: 'row', gap: 24 },
  narrowLayout: { flexDirection: 'column', gap: 24 },
  
  galleryContent: { flex: 1 },
  galleryActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 8 },
  toggleBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  toggleBtnActive: { backgroundColor: 'rgba(91, 168, 245, 0.2)' },
  toggleBtnText: { color: '#64748B', fontSize: 16, fontWeight: '900' },
  toggleBtnTextActive: { color: '#5BA8F5' },
  
  scrollItems: { paddingHorizontal: 16, paddingBottom: 40 },
  cardContainer: { marginBottom: 16 },
});
