import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from '@baishou/shared'
import {
  createDefaultDiaryFilterState,
  DIARY_FILTER_STORAGE_KEYS,
  formatSavedMonth,
  prefetchDiaryFilterState,
  type DiaryFilterState
} from '../diary-filter-state.util'

type DiaryFilterPatch = Partial<
  Pick<
    DiaryFilterState,
    | 'searchQuery'
    | 'selectedMonth'
    | 'filterWeathers'
    | 'filterMoods'
    | 'filterFavorite'
    | 'currentPage'
    | 'pageSize'
  >
>

export function useDiaryFilterState(_dbReady: boolean) {
  const [state, setState] = useState(() => createDefaultDiaryFilterState(false))
  const skipFilterPageResetRef = useRef(true)

  useEffect(() => {
    if (state.restored) return

    let cancelled = false
    void prefetchDiaryFilterState()
      .then((loaded) => {
        if (!cancelled) setState(loaded)
      })
      .catch((e) => {
        logger.error('恢复日记筛选状态失败', e instanceof Error ? e : String(e))
        if (!cancelled) setState(createDefaultDiaryFilterState(true))
      })

    return () => {
      cancelled = true
    }
  }, [state.restored])

  const patchFilter = useCallback((patch: DiaryFilterPatch) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const setSearchQuery = useCallback(
    (searchQuery: string) => {
      patchFilter({ searchQuery })
    },
    [patchFilter]
  )

  const setSelectedMonth = useCallback(
    (selectedMonth: Date | null) => {
      patchFilter({ selectedMonth })
    },
    [patchFilter]
  )

  const setFilterWeathers = useCallback(
    (filterWeathers: string[]) => {
      patchFilter({ filterWeathers })
    },
    [patchFilter]
  )

  const setFilterMoods = useCallback(
    (filterMoods: string[]) => {
      patchFilter({ filterMoods })
    },
    [patchFilter]
  )

  const setFilterFavorite = useCallback(
    (filterFavorite: boolean) => {
      patchFilter({ filterFavorite })
    },
    [patchFilter]
  )

  const setCurrentPage = useCallback(
    (currentPage: number) => {
      patchFilter({ currentPage })
    },
    [patchFilter]
  )

  const setPageSize = useCallback(
    (pageSize: number) => {
      patchFilter({ pageSize })
    },
    [patchFilter]
  )

  const resetFilters = useCallback(() => {
    patchFilter({
      searchQuery: '',
      selectedMonth: null,
      filterWeathers: [],
      filterMoods: [],
      filterFavorite: false,
      currentPage: 1
    })
  }, [patchFilter])

  useEffect(() => {
    if (!state.restored) return
    if (skipFilterPageResetRef.current) {
      skipFilterPageResetRef.current = false
      return
    }
    patchFilter({ currentPage: 1 })
  }, [
    state.selectedMonth,
    state.searchQuery,
    state.filterWeathers,
    state.filterMoods,
    state.filterFavorite,
    state.restored,
    patchFilter
  ])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(DIARY_FILTER_STORAGE_KEYS.searchQuery, state.searchQuery).catch((e) =>
      logger.error('保存搜索查询失败', e)
    )
  }, [state.searchQuery, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(
      DIARY_FILTER_STORAGE_KEYS.selectedMonth,
      formatSavedMonth(state.selectedMonth)
    ).catch((e) => logger.error('保存选中月份失败', e))
  }, [state.selectedMonth, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(
      DIARY_FILTER_STORAGE_KEYS.filterWeathers,
      JSON.stringify(state.filterWeathers)
    ).catch((e) => logger.error('保存天气筛选失败', e))
  }, [state.filterWeathers, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(
      DIARY_FILTER_STORAGE_KEYS.filterMoods,
      JSON.stringify(state.filterMoods)
    ).catch((e) => logger.error('保存心情筛选失败', e))
  }, [state.filterMoods, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(
      DIARY_FILTER_STORAGE_KEYS.filterFavorite,
      String(state.filterFavorite)
    ).catch((e) => logger.error('保存收藏筛选失败', e))
  }, [state.filterFavorite, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(DIARY_FILTER_STORAGE_KEYS.currentPage, String(state.currentPage)).catch(
      (e) => logger.error('保存页码失败', e)
    )
  }, [state.currentPage, state.restored])

  useEffect(() => {
    if (!state.restored) return
    AsyncStorage.setItem(DIARY_FILTER_STORAGE_KEYS.pageSize, String(state.pageSize)).catch((e) =>
      logger.error('保存分页大小失败', e)
    )
  }, [state.pageSize, state.restored])

  return {
    ...state,
    setSearchQuery,
    setSelectedMonth,
    setFilterWeathers,
    setFilterMoods,
    setFilterFavorite,
    setCurrentPage,
    setPageSize,
    resetFilters
  }
}
