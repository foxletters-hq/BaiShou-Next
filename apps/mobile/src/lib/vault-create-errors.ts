import { VaultInvalidNameError, VaultNameExistsError } from '@baishou/core-mobile'
import type { TFunction } from 'i18next'

export function getVaultCreateErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof VaultNameExistsError) {
    return t('workspace.name_exists', {
      name: error.vaultName,
      defaultValue: '工作空间「{{name}}」已存在，请使用其他名称'
    })
  }
  if (error instanceof VaultInvalidNameError) {
    if (error.reason === 'empty') {
      return t('workspace.name_empty', { defaultValue: '请输入工作空间名称' })
    }
    return t('workspace.invalid_name', {
      defaultValue: '名称不能包含 / \\ : % # ? * 等特殊字符'
    })
  }
  return t('workspace.create_failed', { defaultValue: '创建失败' })
}
