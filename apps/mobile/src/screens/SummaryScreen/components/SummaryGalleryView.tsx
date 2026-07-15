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
  clearLocallyDeletedSummary,
  getSummaryDetailPatchVersion,
  markSummaryDeletedLocally,
  patchSummaryDetailCache,
  resolveSummaryForNavigation,
  setPendingSummaryDetail,
  subscribeSummaryDetailPatches,
  isSummaryLocallyDeleted
} from '../utils/summaryDetailCache'

interface Summary {
  id?: number | string
  type: string
  startDate: string
  endDate: string
  content: string
  generatedAt?: string
  updatedAt?: string
}

interface SummaryGalleryViewProps {
  summaries: Summary[]
  loading?: boolean
  onRefreshData: () => Promise<void>
  onSummaryDeleted?: (id: string) => void
}

export const SummaryGalleryView: React.FC<SummaryGalleryViewProps> = ({
  summaries,
  loading = false,
  onRefreshData,
  onSummaryDeleted
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

  const displaySummaries = useMemo(() => {
    void patchVersion
    return applySummaryContentPatches(summaries).filter((s) => !isSummaryLocallyDeleted(String(s.id)))
  }, [summaries, patchVersion])

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
      const updated = await services.summaryManager.update(
        summary.id as number,
        summary.type as SummaryType,
        parseSummaryBoundaryDate(summary.startDate),
        parseSummaryBoundaryDate(summary.endDate),
        { content }
      )
      const toIso = (value: Date | string | null | undefined) =>
        value instanceof Date ? value.toISOString() : value != null ? String(value) : undefined
      patchSummaryDetailCache({
        id: typeof summary.id === 'number' ? summary.id : Number(summary.id),
        type: summary.type,
        startDate: summary.startDate,
        endDate: summary.endDate,
        content,
        generatedAt: toIso(updated.generatedAt) ?? summary.generatedAt,
        updatedAt: toIso(updated.updatedAt) ?? new Date().toISOString()
      })
      await onRefreshData()
    } catch (e) {
      console.error('[SummaryGalleryView] save error:', e)
      toast.showError(t('common.save_failed'))
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    const summary = displaySummaries.find((s) => String(s.id) === id)
    if (!summary || !services) return

    const title = buildSummaryTitle(summary, t)
    const confirmed = await dialog.confirm(t('summary.delete_confirm').replace('$title', title), {
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return
    try {
      // 先从列表拿掉，避免等 dashboard/磁盘扫描才消失
      markSummaryDeletedLocally(id)
      onSummaryDeleted?.(id)
      await services.summaryManager.delete(
        summary.type as SummaryType,
        parseSummaryBoundaryDate(summary.startDate),
        parseSummaryBoundaryDate(summary.endDate)
      )
      await onRefreshData()
      toast.showSuccess(t('common.delete_success'))
    } catch (e) {
      console.error('[SummaryGalleryView] delete error:', e)
      clearLocallyDeletedSummary(id)
      toast.showError(t('common.delete_failed'))
      // 失败时拉回真实列表
      await onRefreshData()
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
          generatedAt: s.generatedAt,
          updatedAt: s.updatedAt
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
