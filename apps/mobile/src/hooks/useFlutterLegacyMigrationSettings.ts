import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

/** 设置页：手动触发旧版迁移 / 删除已迁移的旧目录 */
export function useFlutterLegacyMigrationSettings() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const {
    pendingFlutterLegacyMigration,
    legacyMigrationSourcePendingDeletion,
    runFlutterLegacyMigration,
    deleteMigratedLegacySource
  } = useBaishou()

  const handleMigrateFromFlutterLegacy = useCallback(async () => {
    const pending = pendingFlutterLegacyMigration
    if (!pending) return

    const proceed = await dialog.confirm(
      t('storage.flutter_legacy_migration_prompt_message', {
        source: pending.sourceDisplayPath,
        target: pending.targetDisplayPath,
        defaultValue: `检测到旧版白守的数据仍在：\n${pending.sourceDisplayPath}\n\n是否复制到新版目录？\n${pending.targetDisplayPath}\n\n迁移过程不会删除原目录，全部复制完成后再询问是否清理。`
      }),
      {
        title: t('storage.flutter_legacy_migration_prompt_title', '发现旧版数据'),
        confirmText: t('storage.flutter_legacy_migration_confirm', '开始迁移'),
        cancelText: t('common.cancel', '取消')
      }
    )
    if (!proceed) return

    try {
      const result = await runFlutterLegacyMigration()
      if (!result?.migrated) {
        toast.showWarning(
          t(
            'storage.flutter_legacy_migration_permission_required',
            '需要存储权限才能完成迁移，请授予「管理所有文件」后重试。'
          )
        )
        return
      }
      toast.showToast(
        t('storage.flutter_legacy_migration_complete', '旧版数据已复制到新版目录'),
        'success'
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(
        t('storage.flutter_legacy_migration_failed', {
          error: message,
          defaultValue: `迁移失败：${message}`
        })
      )
    }
  }, [dialog, pendingFlutterLegacyMigration, runFlutterLegacyMigration, t, toast])

  const handleDeleteMigratedLegacySource = useCallback(async () => {
    if (!legacyMigrationSourcePendingDeletion) return

    const proceed = await dialog.confirm(
      t('storage.flutter_legacy_delete_prompt_message', {
        path: displayPath(legacyMigrationSourcePendingDeletion),
        defaultValue: `迁移已完成。是否删除旧版目录以释放空间？\n\n${displayPath(legacyMigrationSourcePendingDeletion)}\n\n删除前已确认新版目录数据完整，此操作不可恢复。`
      }),
      {
        title: t('storage.flutter_legacy_delete_prompt_title', '删除旧版目录？'),
        confirmText: t('storage.flutter_legacy_delete_confirm', '删除旧目录'),
        cancelText: t('common.cancel', '取消'),
        destructive: true
      }
    )
    if (!proceed) return

    const deleted = await deleteMigratedLegacySource()
    if (deleted) {
      toast.showToast(t('storage.flutter_legacy_delete_success', '旧版目录已删除'), 'success')
    } else {
      toast.showError(
        t('storage.flutter_legacy_delete_failed', '无法删除旧版目录，请确认迁移已完成后再试')
      )
    }
  }, [deleteMigratedLegacySource, dialog, legacyMigrationSourcePendingDeletion, t, toast])

  return {
    showMigrateFromFlutterLegacy: !!pendingFlutterLegacyMigration,
    showDeleteMigratedLegacySource: !!legacyMigrationSourcePendingDeletion,
    handleMigrateFromFlutterLegacy,
    handleDeleteMigratedLegacySource
  }
}
