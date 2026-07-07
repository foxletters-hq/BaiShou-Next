import { Platform } from 'react-native'
import type { Dispatch, SetStateAction } from 'react'
import { parseWorkspaceSectionId, type LegacyVersionMigrationSectionId } from '@baishou/core-mobile'
import type { LegacyVersionMigrationImportStatus } from '@baishou/core-mobile'
import type { useDialog, useNativeToast } from '@baishou/ui/native'
import { emitSyncMutation } from '../cache/mobile-cache-coordinator'
import {
  importMobileVersionMigrationAllWorkspaces,
  importMobileVersionMigrationSection,
  type MobileVersionMigrationRuntime
} from '../services/mobile-legacy-version-migration.service'
import type { BaishouContextValue } from '../providers/baishou-provider/types'

type DialogApi = ReturnType<typeof useDialog>
type ToastApi = ReturnType<typeof useNativeToast>

export type VersionMigrationImportDeps = {
  runtime: MobileVersionMigrationRuntime
  t: (key: string, defaultValueOrOptions?: string | Record<string, unknown>) => string
  toast: ToastApi
  dialog: DialogApi
  customLegacySourceRoot: string | null
  sectionStatuses: Partial<
    Record<LegacyVersionMigrationSectionId, LegacyVersionMigrationImportStatus>
  >
  workspaceSectionIds: LegacyVersionMigrationSectionId[]
  runWithStorageQuiesced: BaishouContextValue['runWithStorageQuiesced']
  notifyVersionMigrationComplete: () => void
  promptRestartAfterWorkspaceMigration: () => Promise<void>
  refreshScan: () => Promise<void>
  refreshPermission: () => Promise<boolean>
  services: BaishouContextValue['services'] | null
  setImportBusy: (busy: boolean) => void
  setImportingSection: (sectionId: LegacyVersionMigrationSectionId | null) => void
  setImportProgress: (message: string) => void
  setSectionStatuses: Dispatch<
    SetStateAction<
      Partial<Record<LegacyVersionMigrationSectionId, LegacyVersionMigrationImportStatus>>
    >
  >
  setSectionFailureSamples: Dispatch<
    SetStateAction<Partial<Record<LegacyVersionMigrationSectionId, string[]>>>
  >
}

function isWorkspaceSection(sectionId: LegacyVersionMigrationSectionId): boolean {
  return parseWorkspaceSectionId(sectionId) != null
}

export async function runVersionMigrationSectionImport(
  deps: VersionMigrationImportDeps,
  sectionId: LegacyVersionMigrationSectionId
): Promise<void> {
  const {
    runtime,
    t,
    toast,
    dialog,
    customLegacySourceRoot,
    sectionStatuses,
    runWithStorageQuiesced,
    notifyVersionMigrationComplete,
    promptRestartAfterWorkspaceMigration,
    refreshScan,
    refreshPermission,
    services,
    setImportBusy,
    setImportingSection,
    setImportProgress,
    setSectionStatuses,
    setSectionFailureSamples
  } = deps

  if (Platform.OS === 'android' && !(await refreshPermission())) {
    toast.showWarning(t('version_migration.permission_required'))
    return
  }

  if (sectionStatuses[sectionId] === 'success') {
    const proceedAgain = await dialog.confirm(t('version_migration.reimport_confirm_message'), {
      title: t('version_migration.reimport_confirm_title', '重复导入'),
      confirmText: t('version_migration.import_action', '导入'),
      cancelText: t('common.cancel', '取消')
    })
    if (!proceedAgain) return
  } else {
    const proceed = await dialog.confirm(t('version_migration.import_confirm_message'), {
      title: t('version_migration.import_confirm_title', '确认导入'),
      confirmText: t('version_migration.import_action', '导入'),
      cancelText: t('common.cancel', '取消')
    })
    if (!proceed) return
  }

  setImportBusy(true)
  setImportingSection(sectionId)
  setImportProgress('')
  setSectionStatuses((prev) => ({ ...prev, [sectionId]: 'importing' }))

  try {
    const result = await runWithStorageQuiesced(() =>
      importMobileVersionMigrationSection(runtime, sectionId, {
        onProgress: (msg) => setImportProgress(msg),
        legacySourceRoot: customLegacySourceRoot,
        skipPostImportDiskResync: isWorkspaceSection(sectionId)
      })
    )

    setImportingSection(null)
    setImportProgress('')

    if (result.imported > 0) {
      if (sectionId === 'avatar' && services?.bootstrapper) {
        await services.bootstrapper.resyncFromDisk()
      }
      notifyVersionMigrationComplete()
      if (sectionId === 'avatar') {
        emitSyncMutation('complete', 'version-migration-avatar')
        await runtime.settingsManager.flushToDisk()
      }
    } else if (sectionId === 'avatar' && result.skipped > 0 && services?.bootstrapper) {
      await services.bootstrapper.resyncFromDisk()
    }

    const summary = t('version_migration.import_result_summary', {
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed
    })

    const isFailed = result.failed > 0 && result.imported === 0
    const isPartial = result.failed > 0 && result.imported > 0

    setSectionStatuses((prev) => ({
      ...prev,
      [sectionId]: isFailed ? 'failed' : result.imported > 0 ? 'success' : 'idle'
    }))
    setSectionFailureSamples((prev) => ({
      ...prev,
      [sectionId]: result.failureSamples ?? []
    }))

    if (isFailed) {
      toast.showError(summary)
    } else if (isPartial) {
      toast.showWarning(summary)
    } else if (result.imported > 0) {
      toast.showToast(summary, 'success')
    } else if (result.skipped > 0) {
      toast.showWarning(t('version_migration.import_nothing_new'))
    }

    if (result.errors && result.errors.length > 0) {
      toast.showWarning(
        t('version_migration.import_errors_detail', {
          detail: result.errors.slice(0, 2).join(' · ')
        })
      )
    }
    if (result.failureSamples && result.failureSamples.length > 0) {
      toast.showWarning(
        t('version_migration.import_failures_detail', {
          detail: result.failureSamples.slice(0, 3).join(' · '),
          defaultValue: `失败示例：${result.failureSamples.slice(0, 3).join(' · ')}`
        })
      )
    }

    if (isWorkspaceSection(sectionId) && !isFailed && result.imported > 0) {
      await promptRestartAfterWorkspaceMigration()
    }

    await refreshScan()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    setSectionStatuses((prev) => ({ ...prev, [sectionId]: 'failed' }))
    toast.showError(
      t('version_migration.import_failed', {
        error: message
      })
    )
  } finally {
    setImportingSection(null)
    setImportProgress('')
    setImportBusy(false)
  }
}

export async function runVersionMigrationAllWorkspacesImport(
  deps: VersionMigrationImportDeps
): Promise<void> {
  const {
    runtime,
    t,
    toast,
    dialog,
    customLegacySourceRoot,
    workspaceSectionIds,
    runWithStorageQuiesced,
    notifyVersionMigrationComplete,
    promptRestartAfterWorkspaceMigration,
    refreshScan,
    refreshPermission,
    setImportBusy,
    setImportingSection,
    setImportProgress,
    setSectionStatuses,
    setSectionFailureSamples
  } = deps

  if (workspaceSectionIds.length === 0) return

  if (Platform.OS === 'android' && !(await refreshPermission())) {
    toast.showWarning(t('version_migration.permission_required'))
    return
  }

  const proceed = await dialog.confirm(t('version_migration.import_all_workspaces_confirm'), {
    title: t('version_migration.import_all_workspaces_title'),
    confirmText: t('version_migration.import_action', '导入'),
    cancelText: t('common.cancel', '取消')
  })
  if (!proceed) return

  setImportBusy(true)
  setImportingSection(workspaceSectionIds[0]!)
  setImportProgress('')

  try {
    const result = await runWithStorageQuiesced(() =>
      importMobileVersionMigrationAllWorkspaces(runtime, workspaceSectionIds, {
        onProgress: (msg) => setImportProgress(msg),
        legacySourceRoot: customLegacySourceRoot
      })
    )

    setImportingSection(null)
    setImportProgress('')

    if (result.imported > 0) {
      notifyVersionMigrationComplete()
    }

    const summary = t('version_migration.import_result_summary', {
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed
    })
    const isFailed = result.failed > 0 && result.imported === 0
    const isPartial = result.failed > 0 && result.imported > 0

    setSectionStatuses((prev) => {
      const next = { ...prev }
      for (const sectionResult of result.sectionResults) {
        const sectionFailed = sectionResult.failed > 0 && sectionResult.imported === 0
        next[sectionResult.sectionId] = sectionFailed
          ? 'failed'
          : sectionResult.imported > 0 || sectionResult.skipped > 0
            ? 'success'
            : 'idle'
      }
      return next
    })
    setSectionFailureSamples((prev) => {
      const next = { ...prev }
      for (const sectionResult of result.sectionResults) {
        if (sectionResult.failureSamples?.length) {
          next[sectionResult.sectionId] = sectionResult.failureSamples
        }
      }
      return next
    })

    if (isFailed) {
      toast.showError(summary)
    } else if (isPartial) {
      toast.showWarning(summary)
    } else if (result.imported > 0) {
      toast.showToast(summary, 'success')
    } else if (result.skipped > 0) {
      toast.showWarning(t('version_migration.import_nothing_new'))
    }

    if (result.errors && result.errors.length > 0) {
      toast.showWarning(
        t('version_migration.import_errors_detail', {
          detail: result.errors.slice(0, 2).join(' · ')
        })
      )
    }

    if (!isFailed && result.imported > 0) {
      await promptRestartAfterWorkspaceMigration()
    }

    await refreshScan()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    toast.showError(t('version_migration.import_failed', { error: message }))
  } finally {
    setImportingSection(null)
    setImportProgress('')
    setImportBusy(false)
  }
}
