import { isDiskFullError } from '@baishou/shared'
import type { TFunction } from 'i18next'

export function formatExportErrorMessage(error: unknown, t: TFunction): string {
  const message = error instanceof Error ? error.message : String(error)
  if (isDiskFullError(message)) {
    return t(
      'settings.error_disk_full',
      '磁盘空间不足，请清理空间后重试。导出备份需要与数据量相当的临时磁盘空间。'
    )
  }
  return message.trim() || t('settings.export_failed', { error: '未知错误' })
}
