import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  Modal,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

// 图片画廊接口
export interface GalleryImage {
  uri: string
  caption?: string
}

// 总结数据接口
export interface SummaryItem {
  id?: number | string
  type: string
  startDate: string
  endDate: string
  content: string
  title?: string
  generatedAt?: string
}

export interface GalleryPanelProps {
  // 图片画廊模式
  images?: GalleryImage[]
  onImagePress?: (uri: string) => void

  // 总结画廊模式
  summaries?: SummaryItem[]
  onOpen?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}

// 总结类型标签
const SUMMARY_TABS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
type SummaryTab = (typeof SUMMARY_TABS)[number]

// 总结类型 → i18n 键映射
const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year'
}

const NUM_COLUMNS = 3

/** 计算周数 */
const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - firstDayOfYear.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

/** 格式化日期范围 */
const formatDateRange = (s: SummaryItem): string => {
  if (!s.startDate || !s.endDate) return ''
  const start = new Date(s.startDate)
  const end = new Date(s.endDate)

  if (s.type === 'weekly') {
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
  }
  if (s.type === 'monthly') {
    return `${start.getFullYear()}年${start.getMonth() + 1}月`
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((start.getMonth() + 1) / 3)
    return `${start.getFullYear()}年 Q${q}`
  }
  if (s.type === 'yearly') {
    return `${start.getFullYear()}年`
  }
  return ''
}

/** 获取标题 */
const getTitle = (s: SummaryItem, t: (key: string, fallback: string) => string): string => {
  if (!s.startDate) return t('gallery.summary', '总结')
  const dateObj = new Date(s.startDate)

  if (s.type === 'weekly') {
    const weekNum = getWeekNumber(dateObj)
    return t('summary.card_week_title', `第 ${weekNum} 周`).replace('$week', String(weekNum))
  }
  if (s.type === 'monthly') {
    const month = dateObj.getMonth() + 1
    return t('summary.card_month_title', `${month}月`).replace('$month', String(month))
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((dateObj.getMonth() + 1) / 3)
    const year = dateObj.getFullYear()
    return t('summary.missing_label_quarterly', `${year}年Q${q}`)
      .replace('$year', String(year))
      .replace('$q', String(q))
  }
  if (s.type === 'yearly') {
    const year = dateObj.getFullYear()
    return t('summary.card_year_suffix', `${year}年`).replace('$year', String(year))
  }
  return t('gallery.summary', '总结')
}

/** 获取内容预览 */
const getPreview = (content: string): string => {
  if (!content) return ''
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.replace(/[*_~`]/g, '').substring(0, 80)
    }
  }
  return ''
}

export const GalleryPanel: React.FC<GalleryPanelProps> = ({
  images,
  onImagePress,
  summaries = [],
  onOpen,
  onEdit,
  onDelete,
  onSave
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null)

  // 总结画廊状态
  const [activeTab, setActiveTab] = useState<SummaryTab>('weekly')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const screenWidth = Dimensions.get('window').width
  const imageSize = (screenWidth - 32) / NUM_COLUMNS - 4

  // 判断是否为总结画廊模式
  const isSummaryMode = summaries.length > 0

  // 从所有总结中动态提取年份
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    summaries.forEach((s) => {
      if (s.startDate) {
        const dateObj = new Date(s.startDate)
        const year = dateObj.getFullYear()
        if (year && !isNaN(year)) {
          years.add(String(year))
        }
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [summaries])

  // 按类型及年份过滤，并按时间降序排序
  const filteredAndSortedSummaries = useMemo(() => {
    let items = summaries.filter((s) => s.type === activeTab)

    if (selectedYear !== 'all') {
      items = items.filter((s) => {
        if (!s.startDate) return false
        return new Date(s.startDate).getFullYear().toString() === selectedYear
      })
    }

    return [...items].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
      return timeB - timeA
    })
  }, [summaries, activeTab, selectedYear])

  // 当前选中的总结
  const selectedSummary = useMemo(() => {
    if (selectedId) {
      return filteredAndSortedSummaries.find((s) => String(s.id) === selectedId)
    }
    return filteredAndSortedSummaries[0]
  }, [filteredAndSortedSummaries, selectedId])

  // 处理标签切换
  const handleTabChange = (tab: SummaryTab) => {
    setActiveTab(tab)
    setSelectedId(null)
    setSelectedYear('all')
  }

  // 处理年份筛选
  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedId(null)
  }

  // 处理列表项点击
  const handleItemClick = (id: string) => {
    setSelectedId(id)
    onOpen?.(id)
  }

  // 图片画廊渲染
  const renderImageItem = ({ item }: { item: GalleryImage }) => (
    <Pressable
      style={[
        styles.imageWrapper,
        {
          width: imageSize,
          height: imageSize,
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle
        }
      ]}
      onPress={() => {
        if (onImagePress) {
          onImagePress(item.uri)
        } else {
          setFullscreenUri(item.uri)
        }
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
      {item.caption && (
        <View style={styles.captionBar}>
          <Text style={styles.captionText} numberOfLines={1}>
            {item.caption}
          </Text>
        </View>
      )}
    </Pressable>
  )

  // 总结画廊渲染
  const renderSummaryContent = () => (
    <View style={styles.summaryContainer}>
      {/* 标签栏 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {SUMMARY_TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabButton,
              {
                backgroundColor: activeTab === tab ? colors.primary + '20' : 'transparent',
                borderColor: activeTab === tab ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => handleTabChange(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary }
              ]}
            >
              {t(`summary.tab_${tab}`, tab)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 年份筛选 */}
      {availableYears.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.yearContainer}
          contentContainerStyle={styles.yearContent}
        >
          <Pressable
            style={[
              styles.yearButton,
              {
                backgroundColor: selectedYear === 'all' ? colors.primary + '20' : 'transparent',
                borderColor: selectedYear === 'all' ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => handleYearChange('all')}
          >
            <Text
              style={[
                styles.yearText,
                { color: selectedYear === 'all' ? colors.primary : colors.textSecondary }
              ]}
            >
              {t('gallery.filter_all_years', '全部年份')}
            </Text>
          </Pressable>
          {availableYears.map((year) => (
            <Pressable
              key={year}
              style={[
                styles.yearButton,
                {
                  backgroundColor: selectedYear === year ? colors.primary + '20' : 'transparent',
                  borderColor: selectedYear === year ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => handleYearChange(year)}
            >
              <Text
                style={[
                  styles.yearText,
                  { color: selectedYear === year ? colors.primary : colors.textSecondary }
                ]}
              >
                {year}年
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* 总结列表 */}
      {filteredAndSortedSummaries.length === 0 ? (
        <View style={styles.emptySummary}>
          <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>📋</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('summary.no_data', '无聚合数据产生')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedSummaries}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.summaryItem,
                {
                  backgroundColor:
                    String(item.id) === selectedId ? colors.primary + '10' : colors.bgSurfaceNormal,
                  borderColor:
                    String(item.id) === selectedId ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => handleItemClick(String(item.id))}
            >
              <View style={styles.summaryItemHeader}>
                <Text style={[styles.summaryItemTitle, { color: colors.textPrimary }]}>
                  {getTitle(item, t)}
                </Text>
                <Text style={[styles.summaryItemDate, { color: colors.textTertiary }]}>
                  {formatDateRange(item)}
                </Text>
              </View>
              <Text style={[styles.summaryItemPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                {getPreview(item.content)}
              </Text>
              <View style={styles.summaryItemActions}>
                {onEdit && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                    onPress={() => onEdit(String(item.id))}
                  >
                    <Text style={[styles.actionText, { color: colors.primary }]}>
                      {t('common.edit', '编辑')}
                    </Text>
                  </Pressable>
                )}
                {onDelete && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => onDelete(String(item.id))}
                  >
                    <Text style={[styles.actionText, { color: colors.error }]}>
                      {t('common.delete', '删除')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  )

  // 图片画廊为空状态
  if (!isSummaryMode && (!images || images.length === 0)) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle
          }
        ]}
      >
        <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>🖼️</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('gallery.noImages', '暂无图片')}
        </Text>
      </View>
    )
  }

  // 总结画廊模式
  if (isSummaryMode) {
    return renderSummaryContent()
  }

  // 图片画廊模式
  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <FlatList
        data={images}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderImageItem}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
      />

      {/* Fullscreen Modal */}
      <Modal
        visible={fullscreenUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenUri(null)}
      >
        <Pressable
          style={[styles.fullscreenOverlay, { backgroundColor: colors.inverseSurface }]}
          onPress={() => setFullscreenUri(null)}
        >
          <Pressable style={styles.closeBtn} onPress={() => setFullscreenUri(null)}>
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>
          {fullscreenUri && (
            <Image
              source={{ uri: fullscreenUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  row: {
    gap: 4,
    marginBottom: 4
  },
  imageWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 11
  },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 15
  },
  fullscreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullscreenImage: {
    width: '95%',
    height: '80%'
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300'
  },
  // 总结画廊样式
  summaryContainer: {
    flex: 1
  },
  tabsContainer: {
    marginBottom: 12
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600'
  },
  yearContainer: {
    marginBottom: 16
  },
  yearContent: {
    paddingHorizontal: 16,
    gap: 8
  },
  yearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  yearText: {
    fontSize: 12,
    fontWeight: '500'
  },
  emptySummary: {
    alignItems: 'center',
    paddingVertical: 40,
    opacity: 0.5
  },
  summaryItem: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  summaryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  summaryItemTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  summaryItemDate: {
    fontSize: 12
  },
  summaryItemPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  summaryItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600'
  }
})
