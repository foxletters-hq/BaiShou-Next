import type { SharedMemoryCopyPreview } from '@baishou/shared'

export type SharedMemoryPreviewChip = {
  key: 'diary' | 'yearly' | 'quarterly' | 'monthly' | 'weekly'
  label: string
  count: number
}

export function buildSharedMemoryPreviewChips(
  preview: SharedMemoryCopyPreview,
  t: (key: string, fallback: string) => string
): SharedMemoryPreviewChip[] {
  return (
    [
      {
        key: 'diary' as const,
        label: t('summary.copy_preview_diary', '日记'),
        count: preview.diary
      },
      {
        key: 'yearly' as const,
        label: t('summary.copy_preview_yearly', '年总结'),
        count: preview.yearly
      },
      {
        key: 'quarterly' as const,
        label: t('summary.copy_preview_quarterly', '季度总结'),
        count: preview.quarterly
      },
      {
        key: 'monthly' as const,
        label: t('summary.copy_preview_monthly', '月总结'),
        count: preview.monthly
      },
      {
        key: 'weekly' as const,
        label: t('summary.copy_preview_weekly', '周总结'),
        count: preview.weekly
      }
    ] as const
  ).filter((item) => item.count > 0)
}
