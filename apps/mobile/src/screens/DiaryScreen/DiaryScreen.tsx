import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { View, StatusBar, Keyboard, InteractionManager, AppState } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useRouter, useFocusEffect, useNavigation } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger, parseDateStr } from '@baishou/shared'
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
import { formatDiaryDateStr, mapDiaryListEntries } from './diary-list-display.util'
import { useDiaryPendingStatus } from './useDiaryPendingStatus'
import { diaryPendingOrganizeCount } from './diary-pending-status.util'
import { DiaryPendingStatusBar } from './DiaryPendingStatusBar'
import { DiaryDeleteConfirmModal } from './DiaryDeleteConfirmModal'
import { diaryScreenStyles as styles } from './diary-screen.styles'

export const DiaryScreen: React.FC = () => {
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
  const todayDateKeyRef = useRef(formatDiaryDateStr())
  const todayEntryRequestIdRef = useRef(0)

  const refreshTodayEntry = useCallback(async () => {
    if (!dbReady || !services || !storageReady) return
    const dateKey = formatDiaryDateStr()
    todayDateKeyRef.current = dateKey
    const requestId = ++todayEntryRequestIdRef.current
    try {
      const entry = await services.diaryService.findByDate(parseDateStr(dateKey))
      if (requestId !== todayEntryRequestIdRef.current) return
      setTodayEntry(entry?.id != null ? { id: entry.id } : null)
    } catch {
      if (requestId !== todayEntryRequestIdRef.current) return
      setTodayEntry(null)
    }
  }, [dbReady, services, storageReady])

  const pendingEditorNavRef = useRef(false)
  const listRef = useRef<FlatList<DiaryListEntry> | null>(null)
  const listScrollYRef = useRef(0)
  const lastListScrollLogAtRef = useRef(0)
  const isListFocusedRef = useRef(isListFocused)
  isListFocusedRef.current = isListFocused
  const {
    pendingGraphCount,
    pendingEmbedCount,
    pendingEmbedParts,
    graphConfigured,
    ragConfigured
  } = useDiaryPendingStatus()
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
      void refreshTodayEntry()
      if (!editorBundlePreloadedRef.current) {
        editorBundlePreloadedRef.current = true
        InteractionManager.runAfterInteractions(() => {
          void preloadDiaryEditorWebViewSource()
        })
      }
      return () => {
        clearDiarySearch()
      }
    }, [clearDiarySearch, refreshConfigured, refreshTodayEntry])
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
  }, [archiveRestoreEpoch, dbReady, resetFilters])

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
    void refreshTodayEntry()
  }, [refreshTodayEntry, vaultRevision])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return
      const dateKey = formatDiaryDateStr()
      const dateChanged = dateKey !== todayDateKeyRef.current
      void refreshTodayEntry()
      if (dateChanged) void loadEntries({ silent: true })
    })
    return () => subscription.remove()
  }, [loadEntries, refreshTodayEntry])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
      timer = setTimeout(
        () => {
          const dateKey = formatDiaryDateStr()
          const dateChanged = dateKey !== todayDateKeyRef.current
          void refreshTodayEntry()
          if (dateChanged) void loadEntries({ silent: true })
          schedule()
        },
        Math.max(1000, nextMidnight.getTime() - now.getTime())
      )
    }
    schedule()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [loadEntries, refreshTodayEntry])

  const displayEntries = useMemo(() => mapDiaryListEntries(entries), [entries])

  const ensureStorageThen = useCallback(
    async (action: () => void | Promise<void>) => {
      if (!needsFullFileAccess) {
        await action()
        return
      }
      const ok = await requestStorage()
      if (ok) await action()
    },
    [needsFullFileAccess, requestStorage]
  )

  const handleEditToday = () => {
    void ensureStorageThen(async () => {
      const dateKey = formatDiaryDateStr()
      let entry = todayDateKeyRef.current === dateKey ? todayEntry : null
      if (services?.diaryService) {
        try {
          const requestId = ++todayEntryRequestIdRef.current
          const fresh = await services.diaryService.findByDate(parseDateStr(dateKey))
          entry = fresh?.id != null ? { id: fresh.id } : null
          todayDateKeyRef.current = dateKey
          if (requestId === todayEntryRequestIdRef.current) setTodayEntry(entry)
        } catch {
          // 查询失败时沿用当天缓存，避免误开昨天的日记
        }
      }
      if (entry) {
        openDiaryEditor({ id: String(entry.id), append: '1' })
      } else {
        openDiaryEditor({ date: dateKey })
      }
    })
  }

  const handleAddNew = () => {
    void ensureStorageThen(() => {
      openDiaryEditor({ new: '1', date: formatDiaryDateStr() })
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

          <DiaryPendingStatusBar
            graphConfigured={graphConfigured}
            ragConfigured={ragConfigured}
            pendingGraphCount={pendingGraphCount}
            pendingEmbedCount={pendingEmbedCount}
            pendingEmbedParts={pendingEmbedParts}
          />

          <DiaryFab
            todayEntry={todayEntry}
            onEditToday={handleEditToday}
            onAddNew={handleAddNew}
            hasPendingStatus={
              diaryPendingOrganizeCount({
                graphConfigured,
                ragConfigured,
                pendingGraphCount,
                pendingEmbedCount,
                pendingDiaryCount: pendingEmbedParts.diaries
              }) > 0
            }
          />
        </View>
      </ScreenSafeArea>

      <DiaryDeleteConfirmModal
        visible={deletingId !== null}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => void performDelete()}
      />
    </>
  )
}
