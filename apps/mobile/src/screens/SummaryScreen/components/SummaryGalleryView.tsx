import React, { useMemo, useSyncExternalStore } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { GalleryPanel, useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SummaryType } from '@baishou/shared'
import { buildSummaryTitle } from '../utils/buildSummaryTitle'
import { parseSummaryBoundaryDate } from '../utils/summary-detail.helpers'
import {
  applySummaryContentPatches,
  getSummaryDetailPatchVersion,
  patchSummaryDetailCache,
  resolveSummaryForNavigation,
  setPendingSummaryDetail,
  subscribeSummaryDetailPatches
} from '../utils/summaryDetailCache'

interface Summary {
  id?: number | string
  type: string
  startDate: string
  endDate: string
  content: string
  generatedAt?: string
}

interface SummaryGalleryViewProps {
  summaries: Summary[]
  loading?: boolean
  onRefreshData: () => Promise<void>
}

export const SummaryGalleryView: React.FC<SummaryGalleryViewProps> = ({
  summaries,
  loading = false,
  onRefreshData
}) => {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const { services } = useBaishou()
  const patchVersion = useSyncExternalStore(
    subscribeSummaryDetailPatches,
    getSummaryDetailPatchVersion
  )

  const displaySummaries = useMemo(
    () => applySummaryContentPatches(summaries),
    [summaries, patchVersion]
  )

  const seedSummaryNavigation = (id: string) => {
    const resolved = resolveSummaryForNavigation(
      id,
      displaySummaries.find((s) => String(s.id) === id)
    )
    // 导航只写 pending，不覆盖保存后的 content patch
    if (resolved) {
      setPendingSummaryDetail(resolved)
    }
    router.push({
      pathname: '/summary-detail',
      params: { id }
    })
  }

  const handleSave = async (id: string, content: string) => {
    const summary = displaySummaries.find((s) => String(s.id) === id)
    if (!summary?.id || !services) return
    try {
      await services.summaryManager.update(
        summary.id as number,
        summary.type as SummaryType,
        parseSummaryBoundaryDate(summary.startDate),
        parseSummaryBoundaryDate(summary.endDate),
        { content }
      )
      patchSummaryDetailCache({
        id: typeof summary.id === 'number' ? summary.id : Number(summary.id),
        type: summary.type,
        startDate: summary.startDate,
        endDate: summary.endDate,
        content
      })
      await onRefreshData()
    } catch (e) {
      console.error('[SummaryGalleryView] save error:', e)
      toast.showError(t('common.save_failed'))
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    const summary = summaries.find((s) => String(s.id) === id)
    if (!summary || !services) return

    const title = buildSummaryTitle(summary, t)
    const confirmed = await dialog.confirm(t('summary.delete_confirm').replace('$title', title), {
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return
    try {
      await services.summaryManager.delete(
        summary.type as SummaryType,
        parseSummaryBoundaryDate(summary.startDate),
        parseSummaryBoundaryDate(summary.endDate)
      )
      await onRefreshData()
      toast.showSuccess(t('common.delete_success'))
    } catch (e) {
      console.error('[SummaryGalleryView] delete error:', e)
      toast.showError(t('common.delete_failed'))
    }
  }

  return (
    <View style={styles.gallery}>
      <GalleryPanel
        loading={loading}
        summaries={displaySummaries.map((s) => ({
          id: s.id,
          type: s.type,
          startDate: s.startDate,
          endDate: s.endDate,
          content: s.content,
          generatedAt: s.generatedAt
        }))}
        onOpen={seedSummaryNavigation}
        onEdit={seedSummaryNavigation}
        onDelete={handleDelete}
        onSave={handleSave}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: {
    flex: 1,
    minHeight: 0
  }
})
