import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { WEATHER_IDS, weatherI18nKey, type WeatherId } from '@baishou/shared'
import { YearMonthPicker, useNativeTheme, WeatherEmoji, Input } from '@baishou/ui/native'

export interface DiaryAppBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedMonth: Date | null
  onMonthChange: (m: Date | null) => void
  filterWeathers: string[]
  onFilterWeathersChange: (weathers: string[]) => void
  filterFavorite: boolean
  onFilterFavoriteChange: (v: boolean) => void
  todayEntry: { id: number } | null
  onEditToday: () => void
  onAddNew: () => void
}

export const DiaryAppBar: React.FC<DiaryAppBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedMonth,
  onMonthChange,
  filterWeathers,
  onFilterWeathersChange,
  filterFavorite,
  onFilterFavoriteChange,
  todayEntry,
  onEditToday,
  onAddNew
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width } = useWindowDimensions()
  const compactActions = width < 400
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
    onSearchChange('')
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
          <View style={[styles.searchWrapper, { backgroundColor: colors.bgSurfaceNormal }]}>
            <MaterialIcons name="search" size={18} color={colors.textSecondary} />
            <Input
              style={styles.searchInput}
              placeholder={t('common.search_hint')}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity onPress={closeSearch} style={styles.iconBtn} accessibilityRole="button">
            <MaterialIcons name="close" size={22} color={colors.textPrimary} />
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
            <TouchableOpacity
              onPress={() => setIsSearching(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.search_hint')}
            >
              <MaterialIcons name="search" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onEditToday}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={
                todayEntry ? t('settings.edit_today_tooltip') : t('settings.write_today_tooltip')
              }
            >
              <MaterialIcons
                name={todayEntry ? 'edit-note' : 'today'}
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAddNew}
              style={[
                compactActions ? styles.iconBtn : styles.addBtn,
                compactActions
                  ? undefined
                  : {
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.bgSurface
                    }
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.write_diary_button')}
            >
              <MaterialIcons name="add" size={compactActions ? 22 : 18} color={colors.primary} />
              {!compactActions && (
                <Text style={[styles.addBtnText, { color: colors.primary }]}>
                  {t('settings.write_diary_button')}
                </Text>
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

const styles = StyleSheet.create({
  appBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
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
    gap: 8
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
    gap: 8
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    minHeight: 0
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
    marginLeft: 4
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600'
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
