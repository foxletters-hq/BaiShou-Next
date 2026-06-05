import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView, useWindowDimensions, StatusBar } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import {
  DashboardHeroBanner,
  DashboardStatsCard,
  DashboardSharedMemoryCard,
  ActivityHeatmap,
  useNativeTheme,
  useNativeToast,
  scrollIndicatorStyle
} from '@baishou/ui/native'
import { logger } from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'
import { useSummaryData } from '../../hooks/useSummaryData'
import { useTranslation } from 'react-i18next'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { SummaryTabBar } from './components/SummaryTabBar'
import { SummaryMissingSection } from './components/SummaryMissingSection'
import { SummaryGalleryView } from './components/SummaryGalleryView'
import { resolveSummaryConfig } from '../../services/mobile-summary-config.util'

export const SummaryScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { width } = useWindowDimensions()
  const { colors, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel')
  const slideOffset = useSharedValue(0)

  useEffect(() => {
    slideOffset.value = withTiming(activeTab === 'gallery' ? 1 : 0, { duration: 280 })
  }, [activeTab, slideOffset])

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -slideOffset.value * width }]
  }))
  const [lookbackMonths, setLookbackMonths] = useState(1)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [concurrencyLimit, setConcurrencyLimit] = useState(3)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  const {
    summaries,
    stats,
    missingSummaries,
    generationStates,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    refreshData
  } = useSummaryData()

  const prevStatesRef = useRef<typeof generationStates>({})
  const isWide = width >= 860

  const checkModelConfigured = async (): Promise<boolean> => {
    if (!services) return false
    try {
      const resolution = await resolveSummaryConfig(services.settingsManager)
      if (!resolution.ok) {
        toast.showError(t('summary.model_not_configured'))
        return false
      }
      return true
    } catch (e) {
      toast.showError(t('summary.model_not_configured'))
      return false
    }
  }

  useEffect(() => {
    if (!dbReady || !services) return

    const initActivityData = async () => {
      try {
        const allDiaries = await services.diaryService.listAll({ limit: 10000 })
        const dateCountMap = new Map<string, number>()
        if (allDiaries?.length) {
          allDiaries.forEach((d: { date: Date | string }) => {
            const dateObj = d.date instanceof Date ? d.date : new Date(d.date)
            if (!isNaN(dateObj.getTime())) {
              const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
              dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1)
            }
          })
        }
        const allData = Array.from(dateCountMap.entries()).map(([date, count]) => ({
          date,
          count
        }))
        const yearSet = new Set<number>()
        allData.forEach((d) => {
          const y = parseInt(d.date.substring(0, 4), 10)
          if (!isNaN(y)) yearSet.add(y)
        })
        const years = Array.from(yearSet).sort((a, b) => a - b)
        if (years.length === 0) years.push(new Date().getFullYear())
        setAvailableYears(years)
        if (!years.includes(selectedYear)) setSelectedYear(years[years.length - 1]!)
        setActivityData(allData.filter((d) => d.date.startsWith(`${selectedYear}-`)))
      } catch (e) {
        console.warn('[SummaryPage] init activity data failed:', e)
      }
    }

    initActivityData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady, services])

  useEffect(() => {
    if (!dbReady || !services) return

    const loadYearData = async () => {
      try {
        const allDiaries = await services.diaryService.listAll({ limit: 10000 })
        const dateCountMap = new Map<string, number>()
        allDiaries?.forEach((d: { date: Date | string }) => {
          const dateObj = d.date instanceof Date ? d.date : new Date(d.date)
          if (!isNaN(dateObj.getTime())) {
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
            dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1)
          }
        })
        const filtered = Array.from(dateCountMap.entries())
          .filter(([date]) => date.startsWith(`${selectedYear}-`))
          .map(([date, count]) => ({ date, count }))
        setActivityData(filtered)
      } catch (e) {
        console.warn('[SummaryPage] fetch year failed:', e)
      }
    }

    loadYearData()
  }, [dbReady, services, selectedYear])

  useEffect(() => {
    Object.keys(generationStates).forEach((uKey) => {
      const cur = generationStates[uKey]
      const prev = prevStatesRef.current[uKey]
      if (cur.status === 'error' && (!prev || prev.status !== 'error')) {
        let errText = cur.error || t('common.error')
        if (cur.error?.includes('active provider')) {
          errText = t('summary.model_not_configured')
        } else if (
          cur.error?.includes('timed out') ||
          cur.error?.includes('AbortError') ||
          cur.error?.includes('timeout')
        ) {
          errText = t('summary.generation_timeout')
        }
        toast.showError(`${t('summary.generation_failed')}: ${errText}`)
      }
    })
    prevStatesRef.current = generationStates
  }, [generationStates, t, toast])

  const handleCopyContext = async () => {
    try {
      if (!services?.buildSharedContext) {
        toast.showError(t('common.copy_failed'))
        return
      }
      const contextText = await services.buildSharedContext(lookbackMonths, i18n.language)
      if (contextText) {
        await Clipboard.setStringAsync(contextText)
        toast.showSuccess(t('summary.toast_copied'))
      } else {
        toast.showWarning(t('summary.no_data_to_copy'))
      }
    } catch (e) {
      logger.error('复制共同回忆失败', e instanceof Error ? e : String(e))
      toast.showError(t('common.copy_failed'))
    }
  }

  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return
    const isConfigured = await checkModelConfigured()
    if (!isConfigured) return

    setIsBatchGenerating(true)

    const pendingTasks = missingSummaries.filter((mp) => {
      const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`
      const state = generationStates[uKey]
      return !state || state.status === 'pending' || state.status === 'error'
    })

    if (pendingTasks.length > 0) {
      await queueGeneration(pendingTasks, concurrencyLimit)
      toast.showSuccess(t('summary.batch_queued').replace('$count', String(pendingTasks.length)))
    } else {
      toast.showInfo(t('summary.all_processing'))
    }

    setTimeout(() => setIsBatchGenerating(false), 800)
  }

  const handleStopGeneration = async () => {
    await stopGeneration()
    toast.showSuccess(t('summary.generation_stopped'))
  }

  const handleConcurrencyChange = (n: number) => {
    setConcurrencyLimit(n)
    setConcurrency(n)
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <ScreenSafeArea preset="tab" style={{ backgroundColor: colors.bgApp }}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <SummaryTabBar activeTab={activeTab} onTabChange={setActiveTab} />

          <View style={styles.sliderContainer}>
            <Animated.View style={[styles.sliderTrack, { width: width * 2 }, animatedContainerStyle]}>
              <View style={[styles.sliderPage, { width }, styles.panelPage]}>
                <ScrollView
                  contentContainerStyle={[styles.panelContent, styles.panelScrollContent]}
                  indicatorStyle={scrollIndicatorStyle(isDark)}
                  showsVerticalScrollIndicator={false}
                >
                  <DashboardHeroBanner />
                  <View style={isWide ? styles.wideLayout : styles.narrowLayout}>
                    <View style={styles.flex1}>
                      <DashboardSharedMemoryCard
                        lookbackMonths={lookbackMonths}
                        onMonthsChanged={setLookbackMonths}
                        onCopyContext={handleCopyContext}
                      />
                    </View>
                    <View style={styles.flex1}>
                      <DashboardStatsCard {...stats} />
                    </View>
                  </View>

                  <ActivityHeatmap
                    data={activityData}
                    year={selectedYear}
                    availableYears={availableYears}
                    onYearChange={setSelectedYear}
                  />

                  <SummaryMissingSection
                    missingSummaries={missingSummaries}
                    generationStates={generationStates}
                    stats={stats}
                    isBatchGenerating={isBatchGenerating}
                    concurrencyLimit={concurrencyLimit}
                    onBatchGenerate={handleBatchGenerate}
                    onStopGeneration={handleStopGeneration}
                    onConcurrencyChange={handleConcurrencyChange}
                    onQueueSingle={async (item) => {
                      const isConfigured = await checkModelConfigured()
                      if (isConfigured) {
                        queueGeneration([item], concurrencyLimit)
                      }
                    }}
                  />
                </ScrollView>
              </View>
              <View style={[styles.sliderPage, { width }]}>
                <SummaryGalleryView summaries={summaries} onRefreshData={refreshData} />
              </View>
            </Animated.View>
          </View>
        </View>
      </ScreenSafeArea>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  sliderContainer: {
    flex: 1,
    overflow: 'hidden'
  },
  sliderTrack: {
    flexDirection: 'row',
    flex: 1
  },
  sliderPage: {
    flex: 1
  },
  panelPage: {
    paddingTop: 12
  },
  panelScrollContent: {
    paddingHorizontal: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center'
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center'
  },
  contentGallery: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: 0
  },
  panelContent: {
    gap: 32,
    paddingBottom: 40
  },
  wideLayout: {
    flexDirection: 'row',
    gap: 24
  },
  narrowLayout: {
    flexDirection: 'column',
    gap: 24
  },
  flex1: {
    flex: 1,
    minWidth: 0
  }
})
