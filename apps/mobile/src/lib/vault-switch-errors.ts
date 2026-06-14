import { VaultInvalidNameError } from '@baishou/core-mobile'
import type { TFunction } from 'i18next'

export function getVaultSwitchErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof VaultInvalidNameError) {
    return t('workspace.invalid_name', {
      defaultValue: '名称不能包含 / \\ : % # ? * 等特殊字符'
    })
  }
  return t('workspace.switch_failed', { defaultValue: '切换工作空间失败，请稍后重试' })
}
