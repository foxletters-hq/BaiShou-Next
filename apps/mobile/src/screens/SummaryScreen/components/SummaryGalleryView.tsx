import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { GalleryPanel, useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SummaryType } from '@baishou/shared'
import { buildSummaryTitle } from '../utils/buildSummaryTitle'

interface Summary {
  id?: number | string
  type: string
  startDate: string
  endDate: string
  content: string
}

interface SummaryGalleryViewProps {
  summaries: Summary[]
  onRefreshData: () => void
}

export const SummaryGalleryView: React.FC<SummaryGalleryViewProps> = ({
  summaries,
  onRefreshData
}) => {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const { services } = useBaishou()

  const handleSave = async (id: string, content: string) => {
    const summary = summaries.find((s) => String(s.id) === id)
    if (!summary?.id || !services) return
    try {
      await services.summaryManager.update(
        summary.id as number,
        summary.type as SummaryType,
        new Date(summary.startDate),
        new Date(summary.endDate),
        { content }
      )
      onRefreshData()
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
        new Date(summary.startDate),
        new Date(summary.endDate)
      )
      onRefreshData()
      toast.showSuccess(t('common.delete_success'))
    } catch (e) {
      console.error('[SummaryGalleryView] delete error:', e)
      toast.showError(t('common.delete_failed'))
    }
  }

  return (
    <View style={styles.gallery}>
      <GalleryPanel
        summaries={summaries.map((s) => ({
          id: s.id,
          type: s.type,
          startDate: s.startDate,
          endDate: s.endDate,
          content: s.content
        }))}
        onOpen={(id) => {
          router.push({
            pathname: '/summary-detail',
            params: { id }
          })
        }}
        onEdit={(id) => {
          router.push({
            pathname: '/summary-detail',
            params: { id }
          })
        }}
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
