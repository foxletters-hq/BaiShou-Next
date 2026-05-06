import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
import { DiaryCard, TimelineNode } from '@baishou/ui';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface DiaryEntry {
  id: number;
  date: Date;
  content: string;
  tags: string[];
  preview: string;
  weather?: string;
  mood?: string;
  location?: string;
  isFavorite?: boolean;
}

export const DiaryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [diaries, setDiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterWeather, setFilterWeather] = useState<string | null>(null);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  const fetchDiaries = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const list = await services.diaryService.listAll({ limit: 100 });
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

  // 处理过滤和排序
  const filteredEntries = useMemo(() => {
    if (!diaries || diaries.length === 0) return [];

    let filtered = [...diaries].map(e => {
      let parsedDate = new Date();
      if (e.date) {
        const pd = new Date(e.date);
        if (!isNaN(pd.getTime())) parsedDate = pd;
      }
      if (isNaN(parsedDate.getTime()) || !e.date) {
        if (e.createdAt) {
          const cd = new Date(e.createdAt);
          if (!isNaN(cd.getTime())) parsedDate = cd;
        }
      }

      return {
        id: e.id,
        date: parsedDate,
        content: e.content || '',
        tags: e.tags || [],
        preview: e.preview || e.content?.substring(0, 500) || '',
        weather: e.weather,
        mood: e.mood,
        location: e.location,
        isFavorite: e.isFavorite,
      } as DiaryEntry;
    });

    // 月份过滤
    if (selectedMonth) {
      filtered = filtered.filter(e =>
        e.date.getFullYear() === selectedMonth.getFullYear() &&
        e.date.getMonth() === selectedMonth.getMonth()
      );
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(e =>
        e.preview.toLowerCase().includes(lowerQ) ||
        e.tags.some(tag => tag.toLowerCase().includes(lowerQ))
      );
    }

    // 天气筛选
    if (filterWeather) {
      filtered = filtered.filter(e => e.weather === filterWeather);
    }

    // 收藏筛选
    if (filterFavorite) {
      filtered = filtered.filter(e => e.isFavorite);
    }

    // 按日期降序排序
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

    return filtered;
  }, [diaries, selectedMonth, searchQuery, filterWeather, filterFavorite]);

  // 格式化日期字符串为 YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 获取天气图标
  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'sunny': return '☀️';
      case 'cloudy': return '☁️';
      case 'overcast': return '☁️';
      case 'light_rain': return '🌧️';
      case 'heavy_rain': return '🌧️';
      case 'snow': return '❄️';
      case 'fog': return '🌫️';
      case 'windy': return '💨';
      default: return '🌡️';
    }
  };

  // 获取天气名称
  const getWeatherName = (weather: string) => {
    return t(`diary.weather.${weather}`, weather);
  };

  // 清除所有筛选
  const clearFilters = () => {
    setFilterWeather(null);
    setFilterFavorite(false);
  };

  // 是否有激活的筛选
  const hasActiveFilters = filterWeather || filterFavorite;

  // 查找今天的日记条目
  const todayEntry = useMemo(() => {
    if (!diaries) return null;
    const today = new Date();
    return diaries.find((e: any) => {
      const d = e.date ? new Date(e.date) : null;
      return d && d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    }) || null;
  }, [diaries]);

  // 编辑今日日记：有则追加，无则新建
  const handleEditToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (todayEntry) {
      router.push(`/(tabs)/diary-editor?date=${dateStr}&append=1`);
    } else {
      router.push(`/(tabs)/diary-editor?date=${dateStr}`);
    }
  };

  // 新建日记
  const handleAddNew = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    router.push(`/(tabs)/diary-editor?date=${dateStr}`);
  };

  // 执行删除操作
  const performDelete = async () => {
    if (deletingId === null || !services) return;
    try {
      await services.diaryService.delete(deletingId);
       await fetchDiaries();
       setDeletingId(null);
       Alert.alert(t('common.success', '成功'), t('diary.delete_success', '日记已删除'));
    } catch (e) {
       console.error('Delete failed', e);
       Alert.alert(t('common.error', '错误'), t('diary.delete_failed', '删除失败'));
     }
  };

  // 渲染日记卡片
  const renderDiaryCard = (entry: DiaryEntry, index: number) => {
    const isLast = index === filteredEntries.length - 1;
    const isFirst = index === 0;
    
    const cardContent = (
      <View style={styles.cardWrapper}>
        <DiaryCard 
          id={entry.id}
          contentSnippet={entry.preview || t('diary.no_preview', '暂无预览...')}
          tags={entry.tags || []}
          createdAt={entry.date}
          onClick={() => router.push(`/(tabs)/diary-editor?id=${entry.id}`)}
          onEdit={() => router.push(`/(tabs)/diary-editor?id=${entry.id}`)}
          onDelete={() => setDeletingId(entry.id)}
        />
        {/* 叠加光晕掩码进行降噪隔离 */}
        <View style={[styles.glassMask, { backgroundColor: colors.bgApp + '03' }]} pointerEvents="none" />
      </View>
    );

    if (viewMode === 'timeline') {
      return (
        <TimelineNode key={entry.id} isLast={isLast} isFirst={isFirst}>
          {cardContent}
        </TimelineNode>
      );
    } else {
      return (
        <View key={entry.id} style={styles.gridItem}>
          {cardContent}
        </View>
      );
    }
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('diary.title', '记忆节点')}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.accentGreen }]}>NEURAL SNAPSHOTS (B8.1)</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={[styles.viewModeButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={() => setViewMode(viewMode === 'timeline' ? 'grid' : 'timeline')}
              >
                <Text style={[styles.viewModeButtonText, { color: colors.textSecondary }]}>
                  {viewMode === 'timeline' ? '☷' : '☵'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.todayButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleEditToday}
              >
                <Text style={[styles.todayButtonText, { color: colors.textSecondary }]}>
                  {todayEntry ? '✍️' : '📅'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                onPress={handleAddNew}
              >
                <Text style={styles.addBtnIcon}>✍️</Text>
                <Text style={[styles.addBtnText, { color: colors.primary }]}>{t('diary.write_today', '写日记')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 搜索和筛选栏 */}
          <View style={[styles.searchFilterBar, { backgroundColor: colors.bgSurface }]}>
            <View style={[styles.searchWrapper, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder={t('diary.search_placeholder', '搜索记忆...')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.filterButton, { backgroundColor: hasActiveFilters ? colors.primary : colors.bgSurfaceHighest }]}
              onPress={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Text style={[styles.filterButtonText, { color: hasActiveFilters ? colors.bgSurface : colors.textSecondary }]}>{t('diary.filter', '筛选')}</Text>
            </TouchableOpacity>
          </View>

          {/* 筛选面板 */}
          {isFilterOpen && (
            <View style={[styles.filterPanel, { backgroundColor: colors.bgSurface }]}>
              <View style={styles.filterHeader}>
                <Text style={[styles.filterTitle, { color: colors.textPrimary }]}>{t('diary.filter', '筛选')}</Text>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={[styles.filterClear, { color: colors.primary }]}>{t('diary.clear_filter', '清除')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 收藏筛选 */}
              <TouchableOpacity
                style={[styles.filterOption, { backgroundColor: filterFavorite ? colors.primary + '20' : colors.bgSurfaceHighest }]}
                onPress={() => setFilterFavorite(!filterFavorite)}
              >
                <Text style={[styles.filterOptionText, { color: filterFavorite ? colors.primary : colors.textPrimary }]}>❤️ {t('diary.filter_favorite', '收藏')}</Text>
              </TouchableOpacity>

              {/* 天气筛选 */}
              <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>{t('diary.filter_weather', '天气')}</Text>
              <View style={styles.filterWeatherGrid}>
                {['sunny', 'cloudy', 'overcast', 'light_rain', 'heavy_rain', 'snow', 'fog', 'windy'].map(weather => (
                  <TouchableOpacity
                    key={weather}
                    style={[styles.filterWeatherButton, { 
                      backgroundColor: filterWeather === weather ? colors.primary + '20' : colors.bgSurfaceHighest,
                      borderColor: filterWeather === weather ? colors.primary : 'transparent',
                    }]}
                    onPress={() => setFilterWeather(filterWeather === weather ? null : weather)}
                  >
                    <Text style={styles.filterWeatherIcon}>{getWeatherIcon(weather)}</Text>
                    <Text style={[styles.filterWeatherName, { color: colors.textSecondary }]}>{getWeatherName(weather)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 月份选择器 */}
          <View style={[styles.monthSelector, { backgroundColor: colors.bgSurface }]}>
            <TouchableOpacity
              style={[styles.monthButton, { backgroundColor: colors.bgSurfaceHighest }]}
              onPress={() => setSelectedMonth(null)}
            >
              <Text style={[styles.monthButtonText, { color: !selectedMonth ? colors.primary : colors.textSecondary }]}>{t('diary.all', '全部')}</Text>
            </TouchableOpacity>
            {Array.from({ length: 6 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() - i);
              const isSelected = selectedMonth && 
                selectedMonth.getFullYear() === date.getFullYear() && 
                selectedMonth.getMonth() === date.getMonth();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.monthButton, { backgroundColor: isSelected ? colors.primary + '20' : colors.bgSurfaceHighest }]}
                  onPress={() => setSelectedMonth(new Date(date.getFullYear(), date.getMonth(), 1))}
                >
                  <Text style={[styles.monthButtonText, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                     {t('diary.month_format', { month: date.getMonth() + 1, defaultValue: `${date.getMonth() + 1}月` })}
                   </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 内容区 */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🌌</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                 {selectedMonth ? t('diary.no_diaries_month', '本月暂无日记') : t('diary.no_diaries', '暂无日记，开始记录吧')}
               </Text>
              {selectedMonth && (
                <TouchableOpacity onPress={() => setSelectedMonth(null)}>
                  <Text style={[styles.viewAllButton, { color: colors.primary }]}>{t('common.view_all', '查看全部')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView 
              style={styles.contentContainer} 
              contentContainerStyle={styles.timelinePadding} 
              indicatorStyle="white"
            >
              {viewMode === 'timeline' ? (
                filteredEntries.map((entry, index) => renderDiaryCard(entry, index))
              ) : (
                <View style={styles.gridContainer}>
                  {filteredEntries.map((entry, index) => renderDiaryCard(entry, index))}
                </View>
              )}
              
              <View style={styles.footerMarker}>
                 <Text style={[styles.footerMarkerText, { color: colors.textSecondary }]}>{t('diary.footer_marker', '=== 已触达此神经链路的底层 ===')}</Text>
              </View>
            </ScrollView>
          )}

        </View>
      </SafeAreaView>

      {/* 删除确认弹窗 */}
      {deletingId !== null && (
        <View style={[styles.deleteModalOverlay, { backgroundColor: colors.bgApp + '80' }]}>
          <View style={[styles.deleteModal, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.deleteModalTitle, { color: colors.textPrimary }]}>{t('common.confirm_delete', '确认删除')}</Text>
            <Text style={[styles.deleteModalContent, { color: colors.textSecondary }]}>
               {t('diary.delete_warning', '您确定要永久删除这篇日记吗？此操作不可逆�?')}
             </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={[styles.deleteModalCancelButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={() => setDeletingId(null)}
              >
                <Text style={[styles.deleteModalCancelButtonText, { color: colors.textSecondary }]}>{t('common.cancel', '取消')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteModalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={performDelete}
              >
                <Text style={[styles.deleteModalConfirmButtonText, { color: colors.bgSurface }]}>{t('common.delete', '删除')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1.2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewModeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonText: {
    fontSize: 16,
  },
  todayButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6
  },
  addBtnIcon: {
    fontSize: 14,
  },
  addBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
  searchFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterClear: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterWeatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterWeatherButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterWeatherIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  filterWeatherName: {
    fontSize: 12,
  },
  monthSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  monthButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  timelinePadding: {
    padding: 24,
    paddingBottom: 40
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    width: '48%',
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  glassMask: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    opacity: 0.5
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16
  },
  viewAllButton: {
    fontSize: 14,
    fontWeight: '600'
  },
  footerMarker: {
    alignItems: 'center',
    paddingVertical: 32,
    opacity: 0.3
  },
  footerMarkerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2
  },
  deleteModalOverlay: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     justifyContent: 'center',
     alignItems: 'center',
   },
  deleteModal: {
    width: '80%',
    borderRadius: 20,
    padding: 24,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalContent: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});