import { resolveMigrationStatusText, type RagMigrationStreamResult } from '@baishou/shared'
import type { TFunction } from 'i18next'

type ToastApi = {
  showSuccess: (message: string) => void
  showWarning: (message: string) => void
  showError: (message: string) => void
  showInfo?: (message: string) => void
}

export function showMigrationResultToast(
  result: RagMigrationStreamResult | undefined,
  t: TFunction,
  toast: ToastApi
): void {
  if (!result) return

  const detail = result.statusKey
    ? resolveMigrationStatusText(t, result.statusKey, result.statusParams)
    : ''

  if (result.outcome === 'aborted' || result.aborted) {
    toast.showWarning(
      t(
        'settings.rag_migration_aborted_restored',
        '迁移已中止，已恢复迁移前的向量数据与嵌入模型配置。'
      )
    )
    return
  }

  if (result.outcome === 'completed' || result.completed) {
    toast.showSuccess(
      t('settings.rag_migration_complete', '向量库迁移已完成，日记记忆已用新模型重新嵌入。')
    )
    return
  }

  if (result.outcome === 'no_data') {
    const info = toast.showInfo ?? toast.showWarning
    info(
      t('settings.rag_migration_no_data_toast', '当前没有需要迁移的向量数据。') +
        (detail ? ` ${detail}` : '')
    )
    return
  }

  if (result.outcome === 'interrupted' || result.interrupted) {
    toast.showWarning(
      t(
        'settings.rag_migration_interrupted_toast',
        '向量迁移未完成，已保留备份。请在 RAG 记忆管理中继续迁移或恢复备份。'
      )
    )
    return
  }

  console.error('[RAG Migration] failed:', result)
  if (result.statusKey === 'settings.rag_migration_api_key_missing') {
    toast.showError(detail)
    return
  }
  toast.showError(
    detail ||
      t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', {
        message: result.statusKey || 'unknown'
      })
  )
}
