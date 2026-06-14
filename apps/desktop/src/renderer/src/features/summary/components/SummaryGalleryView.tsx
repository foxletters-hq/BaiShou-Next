import React from 'react'
import { useTranslation } from 'react-i18next'
import { GalleryPanel, useToast, useDialog } from '@baishou/ui'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface Summary {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
}

interface SummaryGalleryViewProps {
  summaries: Summary[]
  onRefreshData: () => Promise<void>
}

/** 计算指定日期是一年中的第几周 */
const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - firstDayOfYear.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

/** 归档画廊视图（GalleryPanel 封装层） */
export const SummaryGalleryView: React.FC<SummaryGalleryViewProps> = ({
  summaries,
  onRefreshData
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const navigate = useNavigate()

  /** 根据总结类型与起始日期生成展示标题 */
  const buildSummaryTitle = (summary: Summary): string => {
    const start = new Date(summary.startDate)
    if (summary.type === 'weekly') {
      return t('summary.missing_label_weekly', 'Week $week, $year')
        .replace('$year', String(start.getFullYear()))
        .replace('$week', String(getWeekNumber(start)))
    }
    if (summary.type === 'monthly') {
      return t('summary.title_monthly', 'Monthly Report ($year-$month)')
        .replace('$year', String(start.getFullYear()))
        .replace('$month', String(start.getMonth() + 1))
    }
    if (summary.type === 'quarterly') {
      return t('summary.missing_label_quarterly', '$year Q$q')
        .replace('$year', String(start.getFullYear()))
        .replace('$q', String(Math.ceil((start.getMonth() + 1) / 3)))
    }
    return t('summary.missing_label_yearly', 'Year $year').replace(
      '$year',
      String(start.getFullYear())
    )
  }

  const handleSave = async (id: string, content: string) => {
    const summary = summaries.find((s) => String(s.id) === id)
    if (!summary) return
    try {
      await window.electron.ipcRenderer.invoke(
        'summary:update',
        summary.id,
        summary.type,
        new Date(summary.startDate),
        new Date(summary.endDate),
        { content }
      )
      toast.showSuccess(t('common.save_success', '保存成功'))
      await onRefreshData()
    } catch (e) {
      console.error('[SummaryGalleryView] save error:', e)
      toast.showError(t('common.save_failed', '保存失败'))
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    const summary = summaries.find((s) => String(s.id) === id)
    if (!summary) return

    const title = buildSummaryTitle(summary)
    const confirmed = await dialog.confirm(
      t(
        'summary.delete_confirm',
        'Are you sure you want to delete the summary for "$title"? This action cannot be undone.'
      ).replace('$title', title)
    )

    if (confirmed) {
      try {
        await window.electron.ipcRenderer.invoke(
          'summary:delete',
          summary.type,
          new Date(summary.startDate),
          new Date(summary.endDate)
        )
        toast.showSuccess(t('common.delete_success', '已删除'))
        await onRefreshData()
      } catch (e) {
        console.error('[SummaryGalleryView] delete error:', e)
        toast.showError(t('common.delete_failed', '删除失败'))
      }
    }
  }

  return (
    <motion.div
      key="gallery"
      className="sp-gallery-view"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <GalleryPanel
        summaries={summaries}
        onOpen={() => {
          // 点击列表项只切换视图，GalleryPanel 内部处理选中状态
        }}
        onEdit={(id) => {
          const summary = summaries.find((s) => String(s.id) === id)
          navigate(`/summary/${id}`, summary ? { state: { summary } } : undefined)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </motion.div>
  )
}
