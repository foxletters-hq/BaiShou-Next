import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, StyleSheet, ScrollView, useWindowDimensions, StatusBar } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
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
import { peekSummaryDashboardCache } from '../../lib/summary-dashboard-cache'
import { emitSyncMutation } from '../../cache/mobile-cache-coordinator'

export const SummaryScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { width } = useWindowDimensions()
  const { colors, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const { services, storageIndexing, vaultRevision } = useBaishou()
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel')
  const slideOffset = useSharedValue(0)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    slideOffset.value = withTiming(activeTab === 'gallery' ? 1 : 0, { duration: 280 })
  }, [activeTab, slideOffset])

  const animatedContainerStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: -slideOffset.value * width }]
    }),
    [width]
  )
  const [lookbackMonths, setLookbackMonths] = useState(1)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [concurrencyLimit, setConcurrencyLimit] = useState(3)
  const [isRescanning, setIsRescanning] = useState(false)

  const {
    summaries,
    stats,
    activityData,
    availableYears,
    missingSummaries,
    generationStates,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    isDetectingMissing,
    refreshDashboard,
    refreshSummaries,
    refreshData,
    refreshMissing
  } = useSummaryData(selectedYear)

  const prevStatesRef = useRef<typeof generationStates>({})
  const prevTabRef = useRef(activeTab)
  const lastFocusRefreshRef = useRef(0)
  const isWide = width >= 860

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[availableYears.length - 1]!)
    }
  }, [availableYears, selectedYear])

  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      const cacheStale = peekSummaryDashboardCache(String(vaultRevision))?.stale ?? true
      if (!cacheStale && now - lastFocusRefreshRef.current < 4000) return
      lastFocusRefreshRef.current = now
      void refreshDashboard()
    }, [refreshDashboard, vaultRevision])
  )

  useEffect(() => {
    const prev = prevTabRef.current
    prevTabRef.current = activeTab

    if (prev !== 'gallery' && activeTab === 'gallery') {
      void refreshSummaries()
    }
    if (prev !== 'panel' && activeTab === 'panel') {
      void refreshMissing()
    }
  }, [activeTab, refreshMissing, refreshSummaries])

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
    Object.keys(generationStates).forEach((uKey) => {
      const cur = generationStates[uKey]
      const prev = prevStatesRef.current[uKey]
      if (cur.status === 'error' && (!prev || prev.status !== 'error')) {
        let errText = cur.error || t('common.error')
        if (cur.error?.includes('active provider') || cur.error?.includes('No summary model')) {
          errText = t('summary.model_not_configured')
        } else if (
          cur.error?.toLowerCase().includes('api key') ||
          cur.error?.includes('invalid_api_key') ||
          cur.error?.includes('unauthorized')
        ) {
          errText = t('agent.error.api_key')
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

  const handleRescan = useCallback(async () => {
    if (!services?.bootstrapper || isRescanning || storageIndexing) return
    setIsRescanning(true)
    try {
      emitSyncMutation('resync-complete', 'manual-rescan')
      await services.bootstrapper.resyncFromDisk()
      await refreshData()
      toast.showSuccess(t('summary.rescan_success'))
    } catch (e) {
      logger.warn('[SummaryScreen] rescan failed:', e instanceof Error ? e : String(e))
      toast.showError(t('summary.rescan_failed'))
    } finally {
      setIsRescanning(false)
    }
  }, [isRescanning, refreshData, services, storageIndexing, t, toast])

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
            <Animated.View
              style={[styles.sliderTrack, { width: width * 2 }, animatedContainerStyle]}
            >
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
                      <DashboardStatsCard
                        {...stats}
                        onRescan={() => void handleRescan()}
                        rescanning={isRescanning || storageIndexing}
                      />
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
                    isDetectingMissing={isDetectingMissing}
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
                    onDetectMissing={() => void refreshMissing()}
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
