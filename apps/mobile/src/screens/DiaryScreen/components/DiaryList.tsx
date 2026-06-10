import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import {
  DiaryCard,
  PageSizeSelector,
  Pagination,
  StoragePermissionPrompt,
  useNativeTheme
} from '@baishou/ui/native'

export interface DiaryListEntry {
  id: number
  date: Date
  content: string
  tags: string[]
  preview: string
  weather?: string
  mood?: string
  location?: string
  isFavorite?: boolean
}

export interface DiaryListProps {
  entries: DiaryListEntry[]
  totalCount: number
  currentPage: number
  pageSize: number
  selectedMonth: Date | null
  loading: boolean
  /** 已授权但外部存储尚未挂载完成 */
  storagePending?: boolean
  onGoToEditor: (id: number) => void
  onDeleteEntry: (id: number) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onViewAll: () => void
  /** 无全文件权限时，在空列表中显示授权按钮（对齐原版 BaiShou） */
  showStoragePermission?: boolean
  onRequestStoragePermission?: () => void | Promise<void>
}

export const DiaryList: React.FC<DiaryListProps> = ({
  entries,
  totalCount,
  currentPage,
  pageSize,
  selectedMonth,
  loading,
  storagePending = false,
  onGoToEditor,
  onDeleteEntry,
  onPageChange,
  onPageSizeChange,
  onViewAll,
  showStoragePermission,
  onRequestStoragePermission
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width } = useWindowDimensions()

  const numColumns = width > 700 ? 2 : 1
  const showPagination = totalCount > pageSize
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginationInfo = useMemo(
    () =>
      t('diary.pagination_info')
        .replace('$total', String(totalCount))
        .replace('$page', String(safeCurrentPage))
        .replace('$pages', String(totalPages)),
    [t, totalCount, safeCurrentPage, totalPages]
  )

  const PaginationBar = ({ placement }: { placement: 'top' | 'bottom' }) => (
    <View
      style={[
        styles.paginationBar,
        placement === 'top' ? styles.paginationBarTop : styles.paginationBarBottom,
        { borderColor: colors.borderSubtle }
      ]}
    >
      <View style={styles.paginationMetaRow}>
        <Text style={[styles.paginationInfo, { color: colors.textTertiary }]} numberOfLines={1}>
          {paginationInfo}
        </Text>
        <PageSizeSelector
          value={pageSize}
          options={[20, 30, 50, 80, 100]}
          label={t('diary.per_page', '条/页')}
          onChange={(size) => {
            onPageSizeChange(size)
            onPageChange(1)
          }}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.paginationNavScroll}
        contentContainerStyle={styles.paginationNavContent}
      >
        <Pagination
          current={safeCurrentPage}
          total={totalPages}
          onChange={onPageChange}
          siblingCount={width >= 400 ? 1 : 0}
          showFirstLast={width >= 360}
          showJumper
        />
      </ScrollView>
    </View>
  )

  if (showStoragePermission && onRequestStoragePermission) {
    return (
      <View style={styles.centered}>
        <StoragePermissionPrompt onRequest={onRequestStoragePermission} compact mode="required" />
      </View>
    )
  }

  if (storagePending && entries.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('storage.mounting', '正在准备日记存储…')}
        </Text>
      </View>
    )
  }

  if (loading && entries.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </View>
    )
  }

  if (totalCount === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="edit-note" size={64} color={colors.primary} style={{ opacity: 0.5 }} />
        <Text style={[styles.emptyText, { color: colors.textTertiary, marginTop: 16 }]}>
          {selectedMonth ? t('diary.no_diaries_month') : t('diary.no_diaries')}
        </Text>
        {selectedMonth && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={[styles.viewAllBtn, { color: colors.primary }]}>
              {t('common.view_all')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <FlatList
      key={`diary-grid-${numColumns}`}
      data={entries}
      numColumns={numColumns}
      keyExtractor={(item) => String(item.id)}
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { backgroundColor: colors.bgApp }]}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      ListHeaderComponent={showPagination ? <PaginationBar placement="top" /> : null}
      ListFooterComponent={showPagination ? <PaginationBar placement="bottom" /> : null}
      renderItem={({ item }) => (
        <View style={styles.cardCell}>
          <DiaryCard
            id={item.id}
            contentSnippet={item.preview || t('diary.no_content_preview')}
            tags={item.tags || []}
            createdAt={item.date}
            weather={item.weather}
            mood={item.mood}
            location={item.location}
            isFavorite={item.isFavorite}
            onClick={() => onGoToEditor(item.id)}
            onEdit={() => onGoToEditor(item.id)}
            onDelete={() => onDeleteEntry(item.id)}
          />
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center'
  },
  viewAllBtn: {
    fontSize: 14,
    fontWeight: '500'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120
  },
  columnWrapper: {
    gap: 12
  },
  cardCell: {
    flex: 1,
    marginBottom: 12
  },
  paginationBar: {
    gap: 10
  },
  paginationBarTop: {
    paddingTop: 4,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  paginationBarBottom: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  paginationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  paginationInfo: {
    flex: 1,
    fontSize: 13
  },
  paginationNavScroll: {
    alignSelf: 'stretch'
  },
  paginationNavContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2
  }
})
