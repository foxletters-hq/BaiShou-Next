import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet, StatusBar, Modal, Text, TouchableOpacity } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  WEATHER_IDS,
  normalizeWeatherId,
  formatDiaryPreviewText,
  type WeatherId
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { logger } from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'
import { DiaryAppBar } from './components/DiaryAppBar'
import { DiaryList, type DiaryListEntry } from './components/DiaryList'
import { useDiaryData, type DiaryPageQuery } from './hooks/useDiaryData'

const STORAGE_KEYS = {
  searchQuery: 'diary_searchQuery',
  selectedMonth: 'diary_selectedMonth',
  filterWeathers: 'diary_filterWeathers',
  filterFavorite: 'diary_filterFavorite',
  currentPage: 'diary_currentPage',
  pageSize: 'diary_pageSize'
} as const

function parseSavedMonth(saved: string | null): Date | null {
  if (!saved || saved === 'all') return null
  try {
    const d = new Date(saved)
    return !isNaN(d.getTime()) ? d : null
  } catch {
    return null
  }
}

function parseFilterWeathers(saved: string | null): string[] {
  if (!saved) return []
  try {
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((w) => normalizeWeatherId(String(w)))
      .filter((w): w is WeatherId => (WEATHER_IDS as readonly string[]).includes(w))
  } catch {
    return []
  }
}

export const DiaryScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const { services, dbReady, vaultRevision, vaultSwitching } = useBaishou()
  const router = useRouter()
  const { needsFullFileAccess, request: requestStorage, storageReady } = useStoragePermission()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [filterWeathers, setFilterWeathers] = useState<string[]>([])
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [todayEntry, setTodayEntry] = useState<{ id: number } | null>(null)
  const [isStateRestored, setIsStateRestored] = useState(false)

  useEffect(() => {
    const restoreState = async () => {
      try {
        const [savedQuery, savedMonth, savedWeathers, savedFavorite, savedPage, savedPageSize] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.searchQuery),
            AsyncStorage.getItem(STORAGE_KEYS.selectedMonth),
            AsyncStorage.getItem(STORAGE_KEYS.filterWeathers),
            AsyncStorage.getItem(STORAGE_KEYS.filterFavorite),
            AsyncStorage.getItem(STORAGE_KEYS.currentPage),
            AsyncStorage.getItem(STORAGE_KEYS.pageSize)
          ])

        if (savedQuery != null) setSearchQuery(savedQuery)

        const month = parseSavedMonth(savedMonth)
        if (savedMonth != null) setSelectedMonth(month)

        setFilterWeathers(parseFilterWeathers(savedWeathers))
        if (savedFavorite === 'true') setFilterFavorite(true)

        if (savedPage) {
          const page = Number(savedPage)
          if (!isNaN(page) && page >= 1) setCurrentPage(page)
        }

        if (savedPageSize) {
          const size = Number(savedPageSize)
          if (!isNaN(size) && [50, 80, 100, 200].includes(size)) setPageSize(size)
        }
      } catch (e) {
        logger.error('恢复日记筛选状态失败', e instanceof Error ? e : String(e))
      } finally {
        setIsStateRestored(true)
      }
    }

    restoreState()
  }, [])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(STORAGE_KEYS.searchQuery, searchQuery).catch((e) =>
      logger.error('保存搜索查询失败', e)
    )
  }, [searchQuery, isStateRestored])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(
      STORAGE_KEYS.selectedMonth,
      selectedMonth ? selectedMonth.toISOString() : 'all'
    ).catch((e) => logger.error('保存选中月份失败', e))
  }, [selectedMonth, isStateRestored])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(STORAGE_KEYS.filterWeathers, JSON.stringify(filterWeathers)).catch((e) =>
      logger.error('保存天气筛选失败', e)
    )
  }, [filterWeathers, isStateRestored])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(STORAGE_KEYS.filterFavorite, String(filterFavorite)).catch((e) =>
      logger.error('保存收藏筛选失败', e)
    )
  }, [filterFavorite, isStateRestored])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(STORAGE_KEYS.currentPage, String(currentPage)).catch((e) =>
      logger.error('保存页码失败', e)
    )
  }, [currentPage, isStateRestored])

  useEffect(() => {
    if (!isStateRestored) return
    AsyncStorage.setItem(STORAGE_KEYS.pageSize, String(pageSize)).catch((e) =>
      logger.error('保存分页大小失败', e)
    )
  }, [pageSize, isStateRestored])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, searchQuery, filterWeathers, filterFavorite])

  const diaryQuery: DiaryPageQuery = useMemo(
    () => ({
      selectedMonth,
      searchQuery,
      filterWeathers,
      filterFavorite,
      page: currentPage,
      pageSize
    }),
    [selectedMonth, searchQuery, filterWeathers, filterFavorite, currentPage, pageSize]
  )

  const { entries, totalCount, loading, loadEntries } = useDiaryData(
    dbReady && !vaultSwitching ? services?.diaryService : undefined,
    diaryQuery
  )

  useEffect(() => {
    if (dbReady && services?.diaryService && storageReady && !vaultSwitching) {
      void loadEntries()
    }
  }, [dbReady, services?.diaryService, storageReady, vaultSwitching, vaultRevision, loadEntries])

  useFocusEffect(
    useCallback(() => {
      if (dbReady && services?.diaryService && storageReady && !vaultSwitching) {
        void loadEntries()
      }
    }, [dbReady, services?.diaryService, loadEntries, storageReady, vaultSwitching, vaultRevision])
  )

  const handleRequestStoragePermission = useCallback(async () => {
    const ok = await requestStorage()
    if (ok && services?.diaryService) {
      await loadEntries()
    }
  }, [loadEntries, requestStorage, services?.diaryService])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!dbReady || !services || !storageReady) return
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    services.diaryService
      .findByDate(new Date(dateStr))
      .then((entry) => setTodayEntry(entry?.id != null ? { id: entry.id } : null))
      .catch(() => setTodayEntry(null))
  }, [dbReady, services, storageReady, loadEntries])

  const displayEntries = useMemo((): DiaryListEntry[] => {
    if (!entries?.length) return []
    return entries.map((e) => {
      let parsedDate = new Date()
      if (e.date) {
        const pd = new Date(e.date)
        if (!isNaN(pd.getTime())) parsedDate = pd
      } else if (e.createdAt) {
        const cd = new Date(e.createdAt)
        if (!isNaN(cd.getTime())) parsedDate = cd
      }
      return {
        id: e.id,
        date: parsedDate,
        content: e.content || '',
        tags: e.tags || [],
        preview: formatDiaryPreviewText(e.preview || e.content?.substring(0, 500) || ''),
        weather: e.weather,
        mood: e.mood,
        location: e.location,
        isFavorite: e.isFavorite
      }
    })
  }, [entries])

  const formatTodayDateStr = () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }

  const ensureStorageThen = useCallback(
    async (action: () => void) => {
      if (!needsFullFileAccess) {
        action()
        return
      }
      const ok = await requestStorage()
      if (ok) action()
    },
    [needsFullFileAccess, requestStorage]
  )

  const handleEditToday = () => {
    void ensureStorageThen(() => {
      router.push({
        pathname: '/diary-editor',
        params: { date: formatTodayDateStr() }
      })
    })
  }

  const handleAddNew = () => {
    void ensureStorageThen(() => {
      router.push({ pathname: '/diary-editor', params: { new: '1' } })
    })
  }

  const performDelete = async () => {
    if (deletingId === null || !services) return
    try {
      await services.diaryService.delete(deletingId)
      await loadEntries()
      setDeletingId(null)
    } catch (e) {
      logger.error('删除日记失败', e instanceof Error ? e : String(e))
    }
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgSurface}
      />
      <ScreenSafeArea preset="tab" style={{ backgroundColor: colors.bgApp }}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <DiaryAppBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            filterWeathers={filterWeathers}
            onFilterWeathersChange={setFilterWeathers}
            filterFavorite={filterFavorite}
            onFilterFavoriteChange={setFilterFavorite}
            todayEntry={todayEntry}
            onEditToday={handleEditToday}
            onAddNew={handleAddNew}
          />

          <DiaryList
            entries={displayEntries}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            selectedMonth={selectedMonth}
            loading={needsFullFileAccess || vaultSwitching ? false : loading}
            onGoToEditor={(id) => router.push({ pathname: '/diary-editor', params: { id } })}
            onDeleteEntry={setDeletingId}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onViewAll={() => setSelectedMonth(null)}
            showStoragePermission={needsFullFileAccess}
            onRequestStoragePermission={handleRequestStoragePermission}
          />
        </View>
      </ScreenSafeArea>

      <Modal
        visible={deletingId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingId(null)}
      >
        <TouchableOpacity
          style={[styles.deleteOverlay, { backgroundColor: colors.bgOverlay }]}
          activeOpacity={1}
          onPress={() => setDeletingId(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.deleteModal, { backgroundColor: colors.bgSurface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.deleteTitle, { color: colors.textPrimary }]}>
              {t('diary.delete_confirm_title')}
            </Text>
            <Text style={[styles.deleteContent, { color: colors.textSecondary }]}>
              {t('diary.delete_confirm_content')}
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteCancel, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={() => setDeletingId(null)}
              >
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirm, { backgroundColor: colors.error }]}
                onPress={performDelete}
              >
                <Text style={{ color: colors.textOnPrimary }}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  deleteOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  deleteModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  deleteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12
  },
  deleteCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  }
})
