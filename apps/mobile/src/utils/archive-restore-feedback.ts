import type { ImportResult } from '@baishou/core-mobile'
import type { TFunction } from 'i18next'

import {
  isArchiveImportSuccessful,
  shouldRefreshVaultAfterArchiveImport
} from '../services/archive-guards.util'

type ToastLike = {
  showSuccess: (message: string) => void
  showWarning: (message: string) => void
  showError: (message: string) => void
}

export { isArchiveImportSuccessful, shouldRefreshVaultAfterArchiveImport }

export function applyArchiveImportFeedback(
  result: ImportResult,
  t: TFunction,
  toast: ToastLike,
  onComplete?: (result: ImportResult) => void,
  options?: { successMessage?: string }
): void {
  if (!isArchiveImportSuccessful(result)) {
    toast.showWarning(t('common.no_data'))
    return
  }

  toast.showSuccess(
    options?.successMessage ??
      t(
        'settings.restore_success_simple',
        '数据恢复成功；工作区文件与数据库已还原，云端同步配置保留本地当前值'
      )
  )

  if (onComplete && shouldRefreshVaultAfterArchiveImport(result)) {
    onComplete(result)
  }
}
