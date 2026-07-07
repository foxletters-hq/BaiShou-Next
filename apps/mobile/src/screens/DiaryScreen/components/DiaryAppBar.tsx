import React, { useState } from 'react'
import { View, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Search, Filter, RefreshCw, X } from 'lucide-react-native'
import { YearMonthPicker, useNativeTheme } from '@baishou/ui/native'
import { diaryAppBarStyles as styles } from './DiaryAppBar.styles'
import { DiaryFilterModal } from './DiaryFilterModal'

export interface DiaryAppBarProps {
  searchQuery: string
  onSearch: (query: string) => void
  selectedMonth: Date | null
  onMonthChange: (m: Date | null) => void
  filterWeathers: string[]
  onFilterWeathersChange: (weathers: string[]) => void
  filterMoods: string[]
  onFilterMoodsChange: (moods: string[]) => void
  filterFavorite: boolean
  onFilterFavoriteChange: (v: boolean) => void
  onSyncPress?: () => void
  isSyncing?: boolean
  /** 搜索 debounce 进行中 */
  isSearchPending?: boolean
  isSearchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
}

export const DiaryAppBar: React.FC<DiaryAppBarProps> = ({
  searchQuery,
  onSearch,
  selectedMonth,
  onMonthChange,
  filterWeathers,
  onFilterWeathersChange,
  filterMoods,
  onFilterMoodsChange,
  filterFavorite,
  onFilterFavoriteChange,
  onSyncPress,
  isSyncing = false,
  isSearchPending = false,
  isSearchOpen,
  onSearchOpenChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const hasActiveFilters = filterWeathers.length > 0 || filterMoods.length > 0 || filterFavorite

  const clearFilters = () => {
    onFilterWeathersChange([])
    onFilterMoodsChange([])
    onFilterFavoriteChange(false)
  }

  const closeSearch = () => {
    onSearchOpenChange(false)
    onSearch('')
  }

  const openSearch = () => {
    onSearchOpenChange(true)
  }

  return (
    <View
      style={[
        styles.appBar,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle
        }
      ]}
    >
      {isSearchOpen ? (
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchSectionWrap,
              styles.searchInputBox,
              {
                backgroundColor: colors.bgGlassSurface,
                borderColor: colors.borderMuted
              }
            ]}
          >
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={onSearch}
              placeholder={t('common.please_search', '请搜索')}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {isSearchPending ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.searchPendingSpinner}
            />
          ) : null}
          <TouchableOpacity
            onPress={closeSearch}
            style={styles.closeSearchBtn}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <X size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainRow}>
          <View style={styles.left}>
            <YearMonthPicker
              selectedMonth={selectedMonth}
              onChange={onMonthChange}
              titlePlaceholder={t('diary.all_diaries')}
            />
            <TouchableOpacity
              style={[
                styles.filterBtn,
                {
                  borderWidth: 1,
                  borderColor: hasActiveFilters ? colors.primary : colors.borderSubtle,
                  backgroundColor: colors.bgSurface
                }
              ]}
              onPress={() => setIsFilterOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('diary.filter')}
            >
              <Filter
                size={20}
                color={hasActiveFilters ? colors.primary : colors.textPrimary}
                strokeWidth={2}
              />
              {hasActiveFilters && (
                <View style={[styles.filterBadge, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.right}>
            {onSyncPress ? (
              <TouchableOpacity
                onPress={onSyncPress}
                style={styles.iconBtn}
                disabled={isSyncing}
                accessibilityRole="button"
                accessibilityLabel={t('data_sync.sync_now')}
                accessibilityState={{ disabled: isSyncing, busy: isSyncing }}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <RefreshCw size={22} color={colors.textPrimary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={openSearch}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.search_hint')}
            >
              {isSearchPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Search size={22} color={colors.textPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DiaryFilterModal
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filterWeathers={filterWeathers}
        onFilterWeathersChange={onFilterWeathersChange}
        filterMoods={filterMoods}
        onFilterMoodsChange={onFilterMoodsChange}
        filterFavorite={filterFavorite}
        onFilterFavoriteChange={onFilterFavoriteChange}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />
    </View>
  )
}
