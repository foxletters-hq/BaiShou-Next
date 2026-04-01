import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, SafeAreaView, StatusBar } from 'react-native';
import { 
  SummaryCard, DashboardHeroBanner, 
  DashboardStatsCard, DashboardSharedMemoryCard 
} from '@baishou/ui';
import { useSummaryDashboardMock } from './hooks/useSummaryDashboardMock';

export const SummaryScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const { state, actions } = useSummaryDashboardMock();

  const isWide = width > 600;

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
              <TouchableOpacity onPress={() => actions.setActiveTab('panel')} style={[styles.tab, state.activeTab === 'panel' && styles.tabActive]}>
                <Text style={[styles.tabText, state.activeTab === 'panel' && styles.tabTextActive]}>大盘脉冲</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => actions.setActiveTab('gallery')} style={[styles.tab, state.activeTab === 'gallery' && styles.tabActive]}>
                <Text style={[styles.tabText, state.activeTab === 'gallery' && styles.tabTextActive]}>碎片画廊</Text>
              </TouchableOpacity>
            </View>
          </View>

          {state.activeTab === 'panel' ? (
            <ScrollView contentContainerStyle={styles.panelContent} indicatorStyle="white">
              <View style={styles.moduleWrapper}>
                 <DashboardHeroBanner />
              </View>
              <View style={isWide ? styles.wideLayout : styles.narrowLayout}>
                <View style={[styles.moduleWrapper, { flex: 1 }]}>
                  <DashboardSharedMemoryCard 
                    lookbackMonths={state.lookbackMonths}
                    onMonthsChanged={actions.setLookbackMonths}
                    onCopyContext={actions.handleCopyContext}
                  />
                </View>
                <View style={[styles.moduleWrapper, { flex: 1 }]}>
                  <DashboardStatsCard {...state.stats} />
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.galleryContent}>
              <View style={styles.galleryActions}>
                  <TouchableOpacity onPress={() => actions.setViewMode('list')} style={[styles.toggleBtn, state.viewMode === 'list' && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, state.viewMode === 'list' && styles.toggleBtnTextActive]}>☵</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => actions.setViewMode('grid')} style={[styles.toggleBtn, state.viewMode === 'grid' && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, state.viewMode === 'grid' && styles.toggleBtnTextActive]}>☷</Text>
                  </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.scrollItems} indicatorStyle="white">
                {state.summaries.map(item => (
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
                ))}
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
