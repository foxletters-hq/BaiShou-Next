import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { 
  SummaryCard, DashboardHeroBanner, 
  DashboardStatsCard, DashboardSharedMemoryCard 
} from '@baishou/ui';
import { useSummaryDashboardMock } from './hooks/useSummaryDashboardMock';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SummaryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { state, actions } = useSummaryDashboardMock();

  const isWide = width > 600;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => actions.setActiveTab('panel')} style={[styles.tab, state.activeTab === 'panel' && styles.tabActive]}>
             <Text style={[styles.tabText, state.activeTab === 'panel' && styles.tabTextActive]}>面试面板</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => actions.setActiveTab('gallery')} style={[styles.tab, state.activeTab === 'gallery' && styles.tabActive]}>
             <Text style={[styles.tabText, state.activeTab === 'gallery' && styles.tabTextActive]}>记忆画廊</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.settingsBtn}>
           <Text style={styles.settingsIcon}>🛠</Text>
        </TouchableOpacity>
      </View>

      {state.activeTab === 'panel' ? (
        <ScrollView contentContainerStyle={styles.panelContent}>
          <DashboardHeroBanner />
          <View style={isWide ? styles.wideLayout : styles.narrowLayout}>
            <View style={{ flex: 1 }}>
              <DashboardSharedMemoryCard 
                lookbackMonths={state.lookbackMonths}
                onMonthsChanged={actions.setLookbackMonths}
                onCopyContext={actions.handleCopyContext}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DashboardStatsCard {...state.stats} />
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.galleryContent}>
           <View style={styles.galleryActions}>
              <TouchableOpacity onPress={() => actions.setViewMode('list')} style={[styles.toggleBtn, state.viewMode === 'list' && styles.toggleBtnActive]}>
                 <Text style={styles.toggleBtnText}>☰</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => actions.setViewMode('grid')} style={[styles.toggleBtn, state.viewMode === 'grid' && styles.toggleBtnActive]}>
                 <Text style={styles.toggleBtnText}>☷</Text>
              </TouchableOpacity>
           </View>
           <ScrollView contentContainerStyle={styles.scrollItems}>
            {state.summaries.map(item => (
              <SummaryCard 
                key={item.id}
                id={item.id}
                title={item.title}
                dateRange={item.dateRange}
                summaryText={item.summaryText}
                type={item.type}
                onClick={() => console.log('Open', item.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48,
    backgroundColor: '#FFFFFF', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  tabs: { flexDirection: 'row', gap: 24 },
  tab: { paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#5BA8F5' },
  tabText: { fontSize: 15, color: '#475569', fontWeight: '500' },
  tabTextActive: { color: '#5BA8F5', fontWeight: 'bold' },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 16 },
  panelContent: { padding: 24, gap: 24 },
  wideLayout: { flexDirection: 'row', gap: 24 },
  narrowLayout: { flexDirection: 'column', gap: 24 },
  galleryContent: { flex: 1 },
  galleryActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 8 },
  toggleBtn: { padding: 6, borderRadius: 4 },
  toggleBtnActive: { backgroundColor: '#F2F2F2' },
  toggleBtnText: { color: '#94A3B8' },
  scrollItems: { paddingHorizontal: 16, paddingBottom: 16 },
});
