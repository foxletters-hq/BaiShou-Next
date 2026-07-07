import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { View, StyleSheet, StatusBar, Modal, Text, TouchableOpacity, Keyboard } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useRouter, useFocusEffect, useNavigation } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
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
import { useDiaryRootExitGuard } from './hooks/useDiaryRootExitGuard'
import { useIncrementalSync } from '../../providers/IncrementalSyncProvider'
import { DIARY_FILTER_STORAGE_KEYS } from './diary-filter-state.util'
import { isDiaryEditorRouteActive } from './diary-editor-route.util'
import { preloadDiaryEditorWebViewSource } from '../../hooks/useDiaryEditorWebViewSource'
import { readDiaryListScrollY, saveDiaryListScrollY } from './diary-list-scroll.util'

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
  const navigation = useNavigation()
  const isListFocused = useIsFocused()
  const editorBundlePreloadedRef = useRef(false)
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
    filterMoods,
    filterFavorite,
    currentPage,
    pageSize,
    setSearchQuery,
    setSelectedMonth,
    setFilterWeathers,
    setFilterMoods,
    setFilterFavorite,
    setCurrentPage,
    setPageSize,
    resetFilters
  } = useDiaryFilterState(dbReady)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [todayEntry, setTodayEntry] = useState<{ id: number } | null>(null)
  const pendingEditorNavRef = useRef(false)
  const listRef = useRef<FlatList<DiaryListEntry> | null>(null)
  const listScrollYRef = useRef(0)
  const lastListScrollLogAtRef = useRef(0)
  const isListFocusedRef = useRef(isListFocused)
  isListFocusedRef.current = isListFocused
  const {
    isSyncing,
    isPlanning,
    isEnabled: incrementalSyncEnabled,
    refreshConfigured,
    runIncrementalSync
  } = useIncrementalSync()

  const clearDiarySearch = useCallback(() => {
    setSearchQuery('')
    setIsSearchOpen(false)
  }, [setSearchQuery])

  const handleDiaryBackPress = useCallback(() => {
    if (isSearchOpen || searchQuery.trim().length > 0) {
      clearDiarySearch()
      return true
    }
    return false
  }, [clearDiarySearch, isSearchOpen, searchQuery])

  useDiaryRootExitGuard({ onBackPress: handleDiaryBackPress })

  useFocusEffect(
    useCallback(() => {
      void refreshConfigured()
      if (!editorBundlePreloadedRef.current) {
        editorBundlePreloadedRef.current = true
        void preloadDiaryEditorWebViewSource()
      }
      return () => {
        clearDiarySearch()
      }
    }, [clearDiarySearch, refreshConfigured])
  )

  useEffect(() => {
    if (!dbReady || archiveRestoreEpoch === 0) return
    resetFilters()
    void AsyncStorage.multiSet([
      [DIARY_FILTER_STORAGE_KEYS.selectedMonth, 'all'],
      [DIARY_FILTER_STORAGE_KEYS.searchQuery, ''],
      [DIARY_FILTER_STORAGE_KEYS.filterWeathers, '[]'],
      [DIARY_FILTER_STORAGE_KEYS.filterMoods, '[]'],
      [DIARY_FILTER_STORAGE_KEYS.filterFavorite, 'false'],
      [DIARY_FILTER_STORAGE_KEYS.currentPage, '1']
    ]).catch((e) => logger.error('归档恢复后重置日记筛选失败', e instanceof Error ? e : String(e)))
  }, [archiveRestoreEpoch, dbReady, resetFilters, t])

  const diaryQuery: DiaryPageQuery = useMemo(
    () => ({
      selectedMonth,
      searchQuery,
      filterWeathers,
      filterMoods,
      filterFavorite,
      page: currentPage,
      pageSize
    }),
    [selectedMonth, searchQuery, filterWeathers, filterMoods, filterFavorite, currentPage, pageSize]
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
      ecosystemResyncEpoch,
      isScreenFocused: isListFocused
    }
  )

  const handleDiarySearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
    },
    [setSearchQuery]
  )

  const openDiaryEditor = useCallback(
    (params: Record<string, string>) => {
      pendingEditorNavRef.current = true
      if (__DEV__) {
        console.log('[DiaryScreen] openDiaryEditor', {
          params,
          listScrollY: listScrollYRef.current,
          persistedScrollY: readDiaryListScrollY(),
          isListFocused: isListFocusedRef.current,
          entryCount: entries.length
        })
      }
      router.push({ pathname: '/diary-editor', params })
      requestAnimationFrame(() => Keyboard.dismiss())
    },
    [router, entries.length]
  )

  useEffect(() => {
    if (!__DEV__) return
    console.log('[DiaryScreen] isListFocused', {
      isListFocused,
      listScrollY: listScrollYRef.current,
      pendingEditorNav: pendingEditorNavRef.current
    })
  }, [isListFocused])

  const handleListScroll = useCallback((offsetY: number) => {
    saveDiaryListScrollY(offsetY)
    if (offsetY >= 0) {
      listScrollYRef.current = offsetY
    }
    if (!__DEV__) return
    const now = Date.now()
    if (now - lastListScrollLogAtRef.current < 250) return
    lastListScrollLogAtRef.current = now
    console.log('[DiaryList] onScroll', {
      offsetY,
      isListFocused: isListFocusedRef.current,
      pendingEditorNav: pendingEditorNavRef.current,
      savedScrollY: listScrollYRef.current
    })
  }, [])

  useEffect(() => {
    const root = navigation.getParent()
    if (!root) return

    const onNavStateChange = () => {
      const editorActive = isDiaryEditorRouteActive(navigation)
      if (__DEV__) {
        console.log('[DiaryScreen] navState', {
          editorActive,
          pendingEditorNav: pendingEditorNavRef.current,
          listScrollY: listScrollYRef.current
        })
      }
      if (editorActive) {
        pendingEditorNavRef.current = false
      }
    }

    onNavStateChange()
    const unsubscribe = root.addListener('state', onNavStateChange)
    return unsubscribe
  }, [navigation])

  const handleGoToEditor = useCallback(
    (id: number) => {
      const y = Math.max(listScrollYRef.current, readDiaryListScrollY())
      if (y > 2) {
        listRef.current?.scrollToOffset({ offset: y, animated: false })
      }
      openDiaryEditor({ id: String(id) })
    },
    [openDiaryEditor]
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
        openDiaryEditor({ id: String(todayEntry.id), append: '1' })
      } else {
        openDiaryEditor({ date: formatTodayDateStr() })
      }
    })
  }

  const handleAddNew = () => {
    void ensureStorageThen(() => {
      // 新建日记：仅作默认日期展示，不加载已有正文（与「编辑今天」不同）
      openDiaryEditor({ new: '1', date: formatTodayDateStr() })
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
            isSearchOpen={isSearchOpen}
            onSearchOpenChange={setIsSearchOpen}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            filterWeathers={filterWeathers}
            onFilterWeathersChange={setFilterWeathers}
            filterMoods={filterMoods}
            onFilterMoodsChange={setFilterMoods}
            filterFavorite={filterFavorite}
            onFilterFavoriteChange={setFilterFavorite}
            onSyncPress={
              incrementalSyncEnabled === true ? () => void handleIncrementalSync() : undefined
            }
            isSyncing={isSyncing || isPlanning}
            isSearchPending={searchPending}
          />

          <DiaryList
            listRef={listRef}
            onListScroll={handleListScroll}
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
