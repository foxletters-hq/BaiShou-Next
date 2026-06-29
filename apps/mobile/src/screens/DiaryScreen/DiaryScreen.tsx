import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { View, StyleSheet, StatusBar, Modal, Text, TouchableOpacity } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { useBaishou } from '../../providers/BaishouProvider'
import { DiaryAppBar } from './components/DiaryAppBar'
import { DiaryFab } from './components/DiaryFab'
import { DiaryList, type DiaryListEntry } from './components/DiaryList'
import { useDiaryData, type DiaryPageQuery } from './hooks/useDiaryData'
import { useDiaryFilterState } from './hooks/useDiaryFilterState'
import { useIncrementalSync } from '../../providers/IncrementalSyncProvider'
import { DIARY_FILTER_STORAGE_KEYS } from './diary-filter-state.util'

export const DiaryScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const {
    services,
    dbReady,
    vaultRevision,
    vaultSwitching,
    storageIndexing,
    archiveRestoreEpoch,
    ecosystemResyncEpoch
  } = useBaishou()
  const router = useRouter()
  const {
    needsFullFileAccess,
    request: requestStorage,
    storageReady,
    isStoragePending,
    mountSlow,
    mountFailed,
    retryMount
  } = useStoragePermission()

  const {
    restored: isFilterRestored,
    searchQuery,
    selectedMonth,
    filterWeathers,
    filterFavorite,
    currentPage,
    pageSize,
    setSearchQuery,
    setSelectedMonth,
    setFilterWeathers,
    setFilterFavorite,
    setCurrentPage,
    setPageSize,
    resetFilters
  } = useDiaryFilterState(dbReady)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [todayEntry, setTodayEntry] = useState<{ id: number } | null>(null)
  const skipInitialFocusRefreshRef = useRef(true)
  const {
    isSyncing,
    isPlanning,
    isEnabled: incrementalSyncEnabled,
    refreshConfigured,
    runIncrementalSync
  } = useIncrementalSync()

  useFocusEffect(
    useCallback(() => {
      void refreshConfigured()
    }, [refreshConfigured])
  )

  useEffect(() => {
    if (!dbReady || archiveRestoreEpoch === 0) return
    resetFilters()
    void AsyncStorage.multiSet([
      [DIARY_FILTER_STORAGE_KEYS.selectedMonth, 'all'],
      [DIARY_FILTER_STORAGE_KEYS.searchQuery, ''],
      [DIARY_FILTER_STORAGE_KEYS.filterWeathers, '[]'],
      [DIARY_FILTER_STORAGE_KEYS.filterFavorite, 'false'],
      [DIARY_FILTER_STORAGE_KEYS.currentPage, '1']
    ]).catch((e) => logger.error('归档恢复后重置日记筛选失败', e instanceof Error ? e : String(e)))
  }, [archiveRestoreEpoch, dbReady, resetFilters])

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

  const diaryListReady = Boolean(
    isFilterRestored && dbReady && services?.diaryService && storageReady && !vaultSwitching
  )

  const { entries, totalCount, loading, searchPending, loadEntries } = useDiaryData(
    dbReady && !vaultSwitching ? services?.diaryService : undefined,
    diaryQuery,
    {
      ready: diaryListReady,
      vaultRevision,
      ecosystemResyncEpoch
    }
  )

  const handleDiarySearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
    },
    [setSearchQuery]
  )

  const handleGoToEditor = useCallback(
    (id: number) => {
      router.push({ pathname: '/diary-editor', params: { id: String(id) } })
    },
    [router]
  )

  const diaryDataReady = Boolean(
    dbReady && services?.diaryService && storageReady && !vaultSwitching
  )

  useFocusEffect(
    useCallback(() => {
      if (!diaryDataReady || isSyncing || !diaryListReady) return
      if (skipInitialFocusRefreshRef.current) {
        skipInitialFocusRefreshRef.current = false
        return
      }
      void loadEntries({ silent: true })
    }, [diaryDataReady, diaryListReady, isSyncing, loadEntries])
  )

  const handleRequestStoragePermission = useCallback(async () => {
    const ok = await requestStorage()
    if (ok && services?.diaryService) {
      await loadEntries()
    }
  }, [loadEntries, requestStorage, services?.diaryService])

  const handleRetryStorageMount = useCallback(async () => {
    const ok = await retryMount()
    if (ok && services?.diaryService) {
      await loadEntries()
    }
  }, [loadEntries, retryMount, services?.diaryService])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages)
  }, [currentPage, totalPages, setCurrentPage])

  useEffect(() => {
    if (!dbReady || !services || !storageReady) return
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    services.diaryService
      .findByDate(new Date(dateStr))
      .then((entry) => setTodayEntry(entry?.id != null ? { id: entry.id } : null))
      .catch(() => setTodayEntry(null))
  }, [dbReady, services, storageReady, vaultRevision])

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
        preview: e.preview || e.content?.substring(0, 500) || '',
        weather: e.weather,
        mood: e.mood,
        location: e.location,
        isFavorite: e.isFavorite,
        tagColors: e.tagColors
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
      if (todayEntry) {
        router.push({
          pathname: '/diary-editor',
          params: { id: String(todayEntry.id), append: '1' }
        })
      } else {
        router.push({
          pathname: '/diary-editor',
          params: { date: formatTodayDateStr() }
        })
      }
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
      await loadEntries({ silent: false })
      setDeletingId(null)
    } catch (e) {
      logger.error('删除日记失败', e instanceof Error ? e : String(e))
    }
  }

  const handleIncrementalSync = useCallback(async () => {
    await runIncrementalSync().catch(() => {})
  }, [runIncrementalSync])

  const listLoading = vaultSwitching || !isFilterRestored || (loading && entries.length === 0)
  const listRefreshing = loading && entries.length > 0

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
            onSearch={handleDiarySearch}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            filterWeathers={filterWeathers}
            onFilterWeathersChange={setFilterWeathers}
            filterFavorite={filterFavorite}
            onFilterFavoriteChange={setFilterFavorite}
            onSyncPress={
              incrementalSyncEnabled === true ? () => void handleIncrementalSync() : undefined
            }
            isSyncing={isSyncing || isPlanning}
            isSearchPending={searchPending}
          />

          <DiaryList
            entries={displayEntries}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            selectedMonth={selectedMonth}
            loading={listLoading}
            refreshing={listRefreshing}
            storagePending={isStoragePending}
            storageSlow={mountSlow}
            storageMountFailed={mountFailed}
            vaultSwitching={vaultSwitching}
            storageIndexing={storageIndexing}
            onRetryStorageMount={handleRetryStorageMount}
            onGoToEditor={handleGoToEditor}
            onDeleteEntry={setDeletingId}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onViewAll={() => setSelectedMonth(null)}
            showStoragePermission={needsFullFileAccess}
            onRequestStoragePermission={handleRequestStoragePermission}
          />

          <DiaryFab todayEntry={todayEntry} onEditToday={handleEditToday} onAddNew={handleAddNew} />
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
    flex: 1,
    position: 'relative'
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
