import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { WEATHER_IDS, weatherI18nKey, type WeatherId } from '@baishou/shared'
import { YearMonthPicker, useNativeTheme, WeatherEmoji } from '@baishou/ui/native'

export interface DiaryAppBarProps {
  searchQuery: string
  onSearch: (query: string) => void
  selectedMonth: Date | null
  onMonthChange: (m: Date | null) => void
  filterWeathers: string[]
  onFilterWeathersChange: (weathers: string[]) => void
  filterFavorite: boolean
  onFilterFavoriteChange: (v: boolean) => void
  onSyncPress?: () => void
  isSyncing?: boolean
  /** 搜索 debounce 进行中 */
  isSearchPending?: boolean
}

export const DiaryAppBar: React.FC<DiaryAppBarProps> = ({
  searchQuery,
  onSearch,
  selectedMonth,
  onMonthChange,
  filterWeathers,
  onFilterWeathersChange,
  filterFavorite,
  onFilterFavoriteChange,
  onSyncPress,
  isSyncing = false,
  isSearchPending = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isSearching, setIsSearching] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const hasActiveFilters = filterWeathers.length > 0 || filterFavorite

  const getWeatherLabel = (id: WeatherId) => t(`diary.weather.${weatherI18nKey(id)}`, id)

  const clearFilters = () => {
    onFilterWeathersChange([])
    onFilterFavoriteChange(false)
  }

  const closeSearch = () => {
    setIsSearching(false)
    onSearch('')
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
      {isSearching ? (
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
            <MaterialIcons name="close" size={20} color={colors.textPrimary} />
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
              <MaterialIcons
                name="filter-list"
                size={20}
                color={hasActiveFilters ? colors.primary : colors.textPrimary}
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
                  <MaterialIcons name="sync" size={22} color={colors.textPrimary} />
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => setIsSearching(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.search_hint')}
            >
              {isSearchPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons name="search" size={22} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={isFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsFilterOpen(false)}>
          <Pressable
            style={[styles.filterPanel, { backgroundColor: colors.bgSurface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.filterHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.filterTitle, { color: colors.textPrimary }]}>
                {t('diary.filter')}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
                  <MaterialIcons name="close" size={14} color={colors.textTertiary} />
                  <Text style={[styles.clearText, { color: colors.textTertiary }]}>
                    {t('diary.clear_filter')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterFavorite && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => onFilterFavoriteChange(!filterFavorite)}
              >
                <MaterialIcons
                  name={filterFavorite ? 'favorite' : 'favorite-border'}
                  size={18}
                  color={filterFavorite ? colors.warning : colors.textPrimary}
                />
                <Text style={[styles.filterOptionText, { color: colors.textPrimary }]}>
                  {t('diary.filter_favorite')}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.filterSectionLabel, { color: colors.textTertiary }]}>
                {t('diary.filter_weather')}
              </Text>
              <View style={styles.weatherList}>
                {WEATHER_IDS.map((weather) => {
                  const active = filterWeathers.includes(weather)
                  const label = getWeatherLabel(weather)
                  return (
                    <TouchableOpacity
                      key={weather}
                      style={[
                        styles.weatherOption,
                        active && { backgroundColor: colors.primaryLight }
                      ]}
                      onPress={() =>
                        onFilterWeathersChange(
                          active
                            ? filterWeathers.filter((w) => w !== weather)
                            : [...filterWeathers, weather]
                        )
                      }
                      accessibilityLabel={label}
                      accessibilityState={{ selected: active }}
                    >
                      <WeatherEmoji weather={weather} size={22} />
                      <Text
                        style={[
                          styles.weatherOptionLabel,
                          { color: active ? colors.primary : colors.textPrimary }
                        ]}
                      >
                        {label}
                      </Text>
                      {active ? (
                        <MaterialIcons name="check" size={18} color={colors.primary} />
                      ) : (
                        <View style={styles.weatherCheckPlaceholder} />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.filterDoneBtn, { backgroundColor: colors.primary }]}
              onPress={() => setIsFilterOpen(false)}
            >
              <Text style={[styles.filterDoneText, { color: colors.textOnPrimary }]}>
                {t('common.done')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const APP_BAR_MIN_HEIGHT = 56

const styles = StyleSheet.create({
  appBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    minHeight: APP_BAR_MIN_HEIGHT,
    justifyContent: 'center'
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 40
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40
  },
  searchPendingSpinner: {
    marginRight: 4
  },
  searchSectionWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center'
  },
  searchInputBox: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
  },
  closeSearchBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  filterPanel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  clearText: {
    fontSize: 13
  },
  filterBody: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500'
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8
  },
  weatherList: {
    marginBottom: 16,
    gap: 2
  },
  weatherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8
  },
  weatherOptionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500'
  },
  weatherCheckPlaceholder: {
    width: 18
  },
  filterDoneBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  filterDoneText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
