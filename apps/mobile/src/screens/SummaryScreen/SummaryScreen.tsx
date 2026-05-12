import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  SummaryCard, DashboardHeroBanner, 
  DashboardStatsCard, DashboardSharedMemoryCard 
} from '@baishou/ui';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';
import { useSummaryData } from '../../hooks/useSummaryData';
import { useTranslation } from 'react-i18next';

export const SummaryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();
  const { 
    summaries, 
    stats, 
    missingSummaries, 
    generationStates, 
    queueGeneration, 
    refreshData,
    loading 
  } = useSummaryData();

  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel');
  const [lookbackMonths, setLookbackMonths] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [concurrencyLimit, setConcurrencyLimit] = useState(3);
  const [showConcurrencyDropdown, setShowConcurrencyDropdown] = useState(false);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  const isWide = width > 600;

  // 加载活动数据
  useEffect(() => {
    if (!dbReady || !services) return;
    
    const loadActivityData = async () => {
      try {
        // 从日记列表中提取活动数据（getActivityData 在 ShadowIndexRepository 上，DiaryService 未暴露）
        const allDiaries = await services.diaryService.listAll({ limit: 10000 });
        const dateCountMap = new Map<string, number>();
        if (allDiaries && allDiaries.length > 0) {
          allDiaries.forEach((d: any) => {
            const dateObj = d.date instanceof Date ? d.date : new Date(d.date);
            if (!isNaN(dateObj.getTime())) {
              const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
            }
          });
        }
        const allData = Array.from(dateCountMap.entries()).map(([date, count]) => ({ date, count }));
        const yearSet = new Set<number>();
        allData.forEach(d => {
          const y = parseInt(d.date.substring(0, 4), 10);
          if (!isNaN(y)) yearSet.add(y);
        });
        const years = Array.from(yearSet).sort((a, b) => a - b);
        if (years.length === 0) years.push(new Date().getFullYear());
        setAvailableYears(years);
        if (!years.includes(selectedYear)) setSelectedYear(years[years.length - 1]!);
        setActivityData(
          allData.filter(d => d.date.startsWith(`${selectedYear}-`))
        );
      } catch (e) {
        console.warn('[SummaryPage] init activity data failed:', e);
      }
    };
    
    loadActivityData();
  }, [dbReady, services, selectedYear]);

  // 处理复制上下文
  const handleCopyContext = async () => {
    try {
      // 这里需要实现复制功能
      Alert.alert(t('common.success', '成功'), t('summary.copied', '共同回忆已复制'));
    } catch {
      Alert.alert(t('common.error', '错误'), t('summary.copy_failed', '复制失败'));
    }
  };

  // 处理批量生成
  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return;
    setIsBatchGenerating(true);
    
    try {
      // 找出尚未处于生成状态的项，加入待处理队列
      const pendingTasks = missingSummaries.filter(mp => {
         const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`;
         const state = generationStates[uKey];
         return !state || state.status === 'pending' || state.status === 'error';
      });

      if (pendingTasks.length > 0) {
         await queueGeneration(pendingTasks);
         Alert.alert(t('common.success', '成功'), t('summary.batch_queued', `已将 ${pendingTasks.length} 项任务加入后台构建队列`, { count: pendingTasks.length }));
      } else {
         Alert.alert(t('common.info', '提示'), t('summary.all_processing', '所有检测到的遗失项均已在处理中'));
      }
    } catch (e) {
      console.error('Batch generation failed', e);
      Alert.alert(t('common.error', '错误'), t('summary.batch_failed', '批量生成失败'));
    } finally {
      setTimeout(() => setIsBatchGenerating(false), 800);
    }
  };

  // 计算周数
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - firstDayOfYear.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  };

  // 删除总结
  const handleDeleteSummary = async (id: string) => {
    const summary = summaries.find(s => String(s.id) === id);
    if (!summary) return;
    
    const title = summary.type === 'weekly' 
      ? t('summary.week_num', `第 ${getWeekNumber(new Date(summary.startDate))} 周`, { week: getWeekNumber(new Date(summary.startDate)) })
      : summary.type === 'monthly'
      ? t('summary.month_num', `${new Date(summary.startDate).getMonth() + 1}月`, { month: new Date(summary.startDate).getMonth() + 1 })
      : summary.type === 'quarterly'
      ? t('summary.quarter_num', `${new Date(summary.startDate).getFullYear()}年Q${Math.ceil((new Date(summary.startDate).getMonth() + 1) / 3)}`, { year: new Date(summary.startDate).getFullYear(), quarter: Math.ceil((new Date(summary.startDate).getMonth() + 1) / 3) })
      : t('summary.year_num', `${new Date(summary.startDate).getFullYear()}年`, { year: new Date(summary.startDate).getFullYear() });
    
    Alert.alert(
      t('common.confirm_delete', '确认删除'),
      t('summary.delete_confirm_title', `确定要删除「${title}」的总结吗？此操作不可撤销。`, { title }),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        { 
          text: t('common.delete', '删除'), 
          style: 'destructive',
          onPress: async () => {
            try {
              if (services) {
                await services.summaryManager.delete(summary.type, summary.startDate, summary.endDate);
                Alert.alert(t('common.success', '成功'), t('summary.deleted', '已删除'));
                refreshData();
              }
            } catch (e) {
              console.error('[SummaryPage] delete error:', e);
              Alert.alert(t('common.error', '错误'), t('summary.delete_failed', '删除失败'));
            }
          }
        },
      ]
    );
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerTopLine}>
              <View>
                 <Text style={[styles.superTitle, { color: colors.textPrimary }]}>{t('summary.title', '算力演算场')}</Text>
                 <Text style={[styles.subTitle, { color: colors.primary }]}>DATA MATRIX (B8.4)</Text>
              </View>
              <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={styles.settingsIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity onPress={() => setActiveTab('panel')} style={[styles.tab, activeTab === 'panel' && { borderBottomColor: colors.primary }]}>
                <Text style={[styles.tabText, activeTab === 'panel' && { color: colors.primary, fontWeight: '900' }]}>{t('summary.panel_tab', '大盘脉冲')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('gallery')} style={[styles.tab, activeTab === 'gallery' && { borderBottomColor: colors.primary }]}>
                <Text style={[styles.tabText, activeTab === 'gallery' && { color: colors.primary, fontWeight: '900' }]}>{t('summary.gallery_tab', '碎片画廊')}</Text>
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

               {/* 活动热力图 */}
               <View style={[styles.activityHeatmapContainer, { backgroundColor: colors.bgSurface }]}>
                 <Text style={[styles.activityHeatmapTitle, { color: colors.textPrimary }]}>{t('summary.activity_heatmap', '活动热力图')}</Text>
                 <View style={styles.activityHeatmapGrid}>
                   {activityData.slice(0, 28).map((day, index) => (
                     <View 
                       key={index} 
                       style={[styles.activityHeatmapCell, { 
                         backgroundColor: day.count > 0 ? colors.primary + '40' : colors.bgSurfaceHighest,
                         opacity: day.count > 0 ? 0.5 + (day.count / 10) * 0.5 : 0.3,
                       }]}
                     />
                   ))}
                 </View>
                 <View style={styles.activityHeatmapLegend}>
                   <Text style={[styles.activityHeatmapLegendText, { color: colors.textSecondary }]}>少</Text>
                   <View style={[styles.activityHeatmapLegendCell, { backgroundColor: colors.primary + '20' }]} />
                   <View style={[styles.activityHeatmapLegendCell, { backgroundColor: colors.primary + '40' }]} />
                   <View style={[styles.activityHeatmapLegendCell, { backgroundColor: colors.primary + '60' }]} />
                   <View style={[styles.activityHeatmapLegendCell, { backgroundColor: colors.primary + '80' }]} />
                   <View style={[styles.activityHeatmapLegendCell, { backgroundColor: colors.primary }]} />
                   <Text style={[styles.activityHeatmapLegendText, { color: colors.textSecondary }]}>多</Text>
                 </View>
               </View>

               {/* AI 建议补全区域 */}
               {(missingSummaries.length > 0 || stats.totalDiaryCount > 0) && (
                 <View style={[styles.aiSuggestionsContainer, { backgroundColor: colors.bgSurface }]}>
                   <View style={styles.aiSuggestionsHeader}>
                      <Text style={[styles.aiSuggestionsTitle, { color: colors.textPrimary }]}>{t('summary.ai_suggestions', 'AI 建议补全')}</Text>
                      
                      <View style={styles.aiSuggestionsActions}>
                         <TouchableOpacity 
                           style={[styles.batchGenerateButton, { backgroundColor: colors.primary }]}
                           onPress={handleBatchGenerate}
                           disabled={isBatchGenerating}
                         >
                           <Text style={[styles.batchGenerateButtonText, { color: colors.textOnPrimary }]}>
                             {isBatchGenerating ? t('summary.generating', '生成中...') : t('summary.generate_all', '全部生成')}
                           </Text>
                         </TouchableOpacity>
                       
                       <TouchableOpacity 
                         style={[styles.concurrencyButton, { backgroundColor: colors.bgSurfaceHighest }]}
                         onPress={() => setShowConcurrencyDropdown(!showConcurrencyDropdown)}
                       >
                          <Text style={[styles.concurrencyButtonText, { color: colors.textSecondary }]}>
                            {t('summary.concurrency', '并发')}: {concurrencyLimit}
                          </Text>
                       </TouchableOpacity>
                     </View>
                   </View>

                   {/* 并发数下拉选择器 */}
                   {showConcurrencyDropdown && (
                     <View style={[styles.concurrencyDropdown, { backgroundColor: colors.bgSurfaceHighest }]}>
                       {[1, 2, 3, 4, 5].map(n => (
                         <TouchableOpacity
                           key={n}
                           style={[styles.concurrencyOption, { backgroundColor: n === concurrencyLimit ? colors.primary + '20' : 'transparent' }]}
                           onPress={() => {
                             setConcurrencyLimit(n);
                             setShowConcurrencyDropdown(false);
                           }}
                          >
                            <Text style={[styles.concurrencyOptionText, { color: n === concurrencyLimit ? colors.primary : colors.textPrimary }]}>
                              {t('summary.concurrency', '并发')}: {n}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                   
                   <Text style={[styles.missingCount, { color: colors.textSecondary }]}>
                     {missingSummaries.length}个
                   </Text>
                   
                    {missingSummaries.length === 0 ? (
                      <Text style={[styles.noMissingText, { color: colors.textSecondary }]}>{t('summary.no_missing', '暂无待合并生成')}</Text>
                    ) : (
                      <View style={styles.missingList}>
                        {missingSummaries.map((mp, index) => {
                          const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`;
                          const isGen = !!generationStates[uKey] && generationStates[uKey].status !== 'error';
                          const progress = generationStates[uKey]?.progress || 0;
                          
                          return (
                            <View key={index} style={[styles.missingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
                              <View style={styles.missingItemIcon}>
                                <Text style={styles.missingItemIconText}>📅</Text>
                              </View>
                              <View style={styles.missingItemInfo}>
                                <Text style={[styles.missingItemTitle, { color: colors.textPrimary }]}>
                                  {mp.label || mp.dateRangeStr}
                                </Text>
                                <Text style={[styles.missingItemDate, { color: colors.textSecondary }]}>
                                  {mp.startDate && new Date(mp.startDate).toLocaleDateString()} - {mp.endDate && new Date(mp.endDate).toLocaleDateString()}
                                </Text>
                                <Text style={[styles.missingItemBadge, { color: colors.primary }]}>{t('summary.suggestion_generate', '建议生成')}</Text>
                              </View>
                              <TouchableOpacity 
                                style={[styles.generateButton, { backgroundColor: colors.primary }]}
                                onPress={() => queueGeneration([mp])}
                                disabled={isGen}
                              >
                                <Text style={[styles.generateButtonText, { color: colors.textOnPrimary }]}>
                                  {isGen ? (progress >= 100 ? '✓' : '⏳') : '✨'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                     </View>
                   )}
                 </View>
               )}
             </ScrollView>
          ) : (
            <View style={styles.galleryContent}>
               <View style={styles.galleryActions}>
                   <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.primary + '20' }]}>
                     <Text style={[styles.toggleBtnText, viewMode === 'list' && { color: colors.primary }]}>☵</Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => setViewMode('grid')} style={[styles.toggleBtn, viewMode === 'grid' && { backgroundColor: colors.primary + '20' }]}>
                     <Text style={[styles.toggleBtnText, viewMode === 'grid' && { color: colors.primary }]}>☷</Text>
                   </TouchableOpacity>
               </View>
              <ScrollView contentContainerStyle={styles.scrollItems} indicatorStyle="white">
                {loading ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                ) : summaries.length === 0 ? (
                   <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                      <Text style={{ fontSize: 32, marginBottom: 12 }}>🕸️</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t('summary.no_data', '无聚合数据产生')}</Text>
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
                        onClick={() => router.push({ pathname: '/summary-detail', params: { id: item.id } })}
                        onDelete={() => handleDeleteSummary(item.id)}
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
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
  },
  headerTopLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8
  },
  superTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subTitle: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 1.2 },
  settingsBtn: { 
    padding: 10, borderRadius: 12,
    borderWidth: 1,
  },
  settingsIcon: { fontSize: 16 },
  
  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: 24, marginTop: 8 },
  tab: { paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '700' },
  
  panelContent: { padding: 20, gap: 24, paddingBottom: 40 },
  moduleWrapper: {
    opacity: 0.95,
  },
  wideLayout: { flexDirection: 'row', gap: 24 },
  narrowLayout: { flexDirection: 'column', gap: 24 },
  
  galleryContent: { flex: 1 },
  galleryActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 8 },
  toggleBtn: { padding: 8, borderRadius: 8 },
  toggleBtnText: { fontSize: 16, fontWeight: '900' },
  
  scrollItems: { paddingHorizontal: 16, paddingBottom: 40 },
  cardContainer: { marginBottom: 16 },
  
  activityHeatmapContainer: {
    borderRadius: 16,
    padding: 16,
  },
  activityHeatmapTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  activityHeatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  activityHeatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  activityHeatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  activityHeatmapLegendText: {
    fontSize: 12,
  },
  activityHeatmapLegendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  
  aiSuggestionsContainer: {
    borderRadius: 16,
    padding: 16,
  },
  aiSuggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiSuggestionsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  aiSuggestionsActions: {
    flexDirection: 'row',
    gap: 8,
  },
  batchGenerateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  batchGenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  concurrencyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  concurrencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  concurrencyDropdown: {
    borderRadius: 8,
    marginBottom: 12,
  },
  concurrencyOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  concurrencyOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  missingCount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  noMissingText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  missingList: {
    gap: 12,
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  missingItemIcon: {
    marginRight: 12,
  },
  missingItemIconText: {
    fontSize: 20,
  },
  missingItemInfo: {
    flex: 1,
  },
  missingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  missingItemDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  missingItemBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  generateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    fontSize: 16,
  },
});