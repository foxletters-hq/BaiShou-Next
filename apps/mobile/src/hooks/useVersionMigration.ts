import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { isLegacyAppRoot, normalizeImportedSectionIds } from '@baishou/core-mobile'
import { isWorkspaceSectionId } from '@baishou/core-mobile'
import type {
  LegacyVersionMigrationImportStatus,
  LegacyVersionMigrationScanResult,
  LegacyVersionMigrationSectionId,
  LegacyVersionMigrationSectionPreview,
  LegacyVersionMigrationWorkspacePreview
} from '@baishou/core-mobile'
import { useBaishou } from '../providers/BaishouProvider'
import {
  importMobileVersionMigrationAllWorkspaces,
  importMobileVersionMigrationSection,
  resolveVersionMigrationLegacySource,
  scanMobileVersionMigration,
  type LegacySourceResolution,
  type MobileVersionMigrationRuntime
} from '../services/mobile-legacy-version-migration.service'
import {
  getCustomLegacySourceRoot,
  loadVersionMigrationState,
  setCustomLegacySourceRoot
} from '../services/mobile-legacy-version-migration.state'
import {
  hasStoragePermission,
  requestStoragePermission
} from '../services/storage-permission.service'
import { pickUserDirectory } from '../services/pick-directory.service'
import { invalidateUserAvatarDisplayCache } from '../lib/user-avatar-display.util'

type GlobalSectionUiState = LegacyVersionMigrationSectionPreview & {
  importStatus: LegacyVersionMigrationImportStatus
  failureSamples?: string[]
}

type WorkspaceSectionUiState = LegacyVersionMigrationWorkspacePreview & {
  importStatus: LegacyVersionMigrationImportStatus
  failureSamples?: string[]
}

export function useVersionMigration() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const {
    services,
    dbReady,
    runWithStorageQuiesced,
    vaultRevision,
    notifyVersionMigrationComplete,
    resyncAfterMigration
  } = useBaishou()

  const [pageReady, setPageReady] = useState(false)
  const [scanResult, setScanResult] = useState<LegacyVersionMigrationScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [importingSection, setImportingSection] = useState<LegacyVersionMigrationSectionId | null>(
    null
  )
  const [importProgress, setImportProgress] = useState('')
  const [sectionStatuses, setSectionStatuses] = useState<
    Partial<Record<LegacyVersionMigrationSectionId, LegacyVersionMigrationImportStatus>>
  >({})
  const [sectionFailureSamples, setSectionFailureSamples] = useState<
    Partial<Record<LegacyVersionMigrationSectionId, string[]>>
  >({})
  const [allFilesAccessGranted, setAllFilesAccessGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true
  )
  const [dbUnavailable, setDbUnavailable] = useState(false)
  const [customLegacySourceRoot, setCustomLegacySourceRootState] = useState<string | null>(null)
  const [customRootLoaded, setCustomRootLoaded] = useState(false)
  const [legacySourceInfo, setLegacySourceInfo] = useState<LegacySourceResolution | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)

  const initialScanDoneRef = useRef(false)
  const lastVaultRevisionRef = useRef(vaultRevision)

  const refreshPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setAllFilesAccessGranted(true)
      return true
    }
    const granted = await hasStoragePermission()
    setAllFilesAccessGranted(granted)
    return granted
  }, [])

  const promptRestartAfterWorkspaceMigration = useCallback(async () => {
    await dialog.alert(
      t('version_migration.restart_message'),
      t('version_migration.restart_title', '请重启应用')
    )
  }, [dialog, t])

  useFocusEffect(
    useCallback(() => {
      void refreshPermission()
    }, [refreshPermission])
  )

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setPageReady(true)
    })
    return () => task.cancel()
  }, [])

  useEffect(() => {
    void getCustomLegacySourceRoot().then((root) => {
      setCustomLegacySourceRootState(root)
      setCustomRootLoaded(true)
    })
  }, [])

  const runtime = useMemo((): MobileVersionMigrationRuntime | null => {
    if (!services || !dbReady) return null
    if (!services.expoDb) {
      return null
    }
    return {
      fileSystem: services.fileSystem,
      sqliteClient: services.expoDb,
      settingsRepo: services.settingsRepo,
      profileRepo: services.profileRepo,
      diaryService: services.diaryService,
      assistantManager: services.assistantManager,
      sessionManager: services.sessionManager,
      sessionRepo: services.sessionRepo,
      vaultService: services.vaultService,
      settingsManager: services.settingsManager,
      pathService: services.pathService,
      getTargetRoot: async () => services.pathService.getRootDirectory()
    }
  }, [dbReady, services])

  useEffect(() => {
    if (!services || !dbReady) {
      setDbUnavailable(false)
      return
    }
    setDbUnavailable(!services.expoDb)
  }, [dbReady, services])

  const refreshScan = useCallback(async () => {
    if (!runtime) return
    if (Platform.OS === 'android' && !(await refreshPermission())) {
      return
    }

    setScanning(true)
    try {
      const targetRoot = await runtime.getTargetRoot()
      const source = await resolveVersionMigrationLegacySource(
        runtime.fileSystem,
        targetRoot,
        customLegacySourceRoot
      )
      setLegacySourceInfo(source)

      const result = await scanMobileVersionMigration(runtime, {
        legacySourceRoot: customLegacySourceRoot
      })
      setScanResult(result)
      const imported = await loadVersionMigrationState()
      if (imported?.importedSections) {
        const legacyVaultNames = result.workspaces.map((ws) => ws.legacyVaultName)
        const normalizedIds = normalizeImportedSectionIds(
          imported.importedSections,
          legacyVaultNames
        )
        const next: Partial<
          Record<LegacyVersionMigrationSectionId, LegacyVersionMigrationImportStatus>
        > = {}
        for (const id of normalizedIds) {
          next[id] = 'success'
        }
        setSectionStatuses(next)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(
        t('version_migration.scan_failed', {
          error: message,
          defaultValue: `扫描失败：${message}`
        })
      )
    } finally {
      setScanning(false)
    }
  }, [customLegacySourceRoot, refreshPermission, runtime, t, toast])

  useEffect(() => {
    if (!pageReady || !runtime || !customRootLoaded) return
    if (initialScanDoneRef.current) return

    const frameId = requestAnimationFrame(() => {
      void refreshScan().then(() => {
        initialScanDoneRef.current = true
        lastVaultRevisionRef.current = vaultRevision
      })
    })
    return () => cancelAnimationFrame(frameId)
  }, [pageReady, runtime, customRootLoaded, refreshScan, vaultRevision])

  useEffect(() => {
    if (!pageReady || !runtime || !initialScanDoneRef.current) return
    if (lastVaultRevisionRef.current === vaultRevision) return
    lastVaultRevisionRef.current = vaultRevision
    void refreshScan()
  }, [pageReady, refreshScan, runtime, vaultRevision])

  const globalSections: GlobalSectionUiState[] = useMemo(() => {
    if (!scanResult) return []
    return scanResult.globalSections.map((section) => ({
      ...section,
      importStatus: sectionStatuses[section.sectionId] ?? 'idle',
      failureSamples: sectionFailureSamples[section.sectionId]
    }))
  }, [scanResult, sectionFailureSamples, sectionStatuses])

  const workspaceSections: WorkspaceSectionUiState[] = useMemo(() => {
    if (!scanResult) return []
    return scanResult.workspaces.map((workspace) => ({
      ...workspace,
      importStatus: sectionStatuses[workspace.sectionId] ?? 'idle',
      failureSamples: sectionFailureSamples[workspace.sectionId]
    }))
  }, [scanResult, sectionFailureSamples, sectionStatuses])

  const handleRequestAllFilesAccess = useCallback(async () => {
    const granted = await requestStoragePermission()
    setAllFilesAccessGranted(granted)
    if (granted) {
      await refreshScan()
    }
  }, [refreshScan])

  const applyLegacyDirectory = useCallback(
    async (path: string) => {
      if (!runtime) return
      const normalized = path.startsWith('file://') ? path : `file://${path}`
      if (!(await isLegacyAppRoot(runtime.fileSystem, normalized))) {
        toast.showError(
          t(
            'version_migration.invalid_legacy_directory',
            '所选目录不是有效的旧版白守数据目录，请选择包含工作区的 BaiShou_Root 文件夹。'
          )
        )
        return
      }
      await setCustomLegacySourceRoot(normalized)
      setCustomLegacySourceRootState(normalized)
      await refreshScan()
    },
    [refreshScan, runtime, t, toast]
  )

  const handleChooseLegacyDirectory = useCallback(async () => {
    if (!runtime) return
    if (Platform.OS === 'android' && !(await refreshPermission())) {
      toast.showWarning(t('version_migration.permission_required'))
      return
    }

    const nativePick = await pickUserDirectory()
    if (nativePick.status === 'selected') {
      await applyLegacyDirectory(nativePick.path)
      return
    }
    if (nativePick.status === 'canceled') return

    setPickerVisible(true)
  }, [applyLegacyDirectory, refreshPermission, runtime, t, toast])

  const handleDirectorySelected = useCallback(
    async (path: string) => {
      setPickerVisible(false)
      await applyLegacyDirectory(path)
    },
    [applyLegacyDirectory]
  )

  const handleClearCustomLegacyDirectory = useCallback(async () => {
    await setCustomLegacySourceRoot(null)
    setCustomLegacySourceRootState(null)
    await refreshScan()
  }, [refreshScan])

  const closeDirectoryPicker = useCallback(() => {
    setPickerVisible(false)
  }, [])

  const handleImportSection = useCallback(
    async (sectionId: LegacyVersionMigrationSectionId) => {
      if (!runtime) return

      if (Platform.OS === 'android' && !(await refreshPermission())) {
        toast.showWarning(t('version_migration.permission_required'))
        return
      }

      if (sectionStatuses[sectionId] === 'success') {
        const proceedAgain = await dialog.confirm(
          t('version_migration.reimport_confirm_message'),
          {
            title: t('version_migration.reimport_confirm_title', '重复导入'),
            confirmText: t('version_migration.import_action', '导入'),
            cancelText: t('common.cancel', '取消')
          }
        )
        if (!proceedAgain) return
      } else {
        const proceed = await dialog.confirm(t('version_migration.import_confirm_message'), {
          title: t('version_migration.import_confirm_title', '确认导入'),
          confirmText: t('version_migration.import_action', '导入'),
          cancelText: t('common.cancel', '取消')
        })
        if (!proceed) return
      }

      setImportingSection(sectionId)
      setImportProgress('')
      setSectionStatuses((prev) => ({ ...prev, [sectionId]: 'importing' }))

      try {
        const result = await runWithStorageQuiesced(() =>
          importMobileVersionMigrationSection(runtime, sectionId, {
            onProgress: (msg) => setImportProgress(msg),
            legacySourceRoot: customLegacySourceRoot
          })
        )

        if (result.imported > 0) {
          if (isWorkspaceSectionId(sectionId)) {
            await resyncAfterMigration()
          } else if (sectionId === 'avatar' && services?.bootstrapper) {
            await services.bootstrapper.resyncFromDisk()
          }
          notifyVersionMigrationComplete()
          if (sectionId === 'avatar') {
            invalidateUserAvatarDisplayCache()
            await runtime.settingsManager.flushToDisk()
          }
        } else if (isWorkspaceSectionId(sectionId) && result.skipped > 0) {
          await resyncAfterMigration()
        } else if (
          sectionId === 'avatar' &&
          result.skipped > 0 &&
          services?.bootstrapper
        ) {
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

        if (
          isWorkspaceSectionId(sectionId) &&
          !isFailed &&
          (result.imported > 0 || result.skipped > 0)
        ) {
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
      }
    },
    [
      customLegacySourceRoot,
      dialog,
      notifyVersionMigrationComplete,
      promptRestartAfterWorkspaceMigration,
      refreshPermission,
      refreshScan,
      resyncAfterMigration,
      runWithStorageQuiesced,
      runtime,
      sectionStatuses,
      services,
      t,
      toast
    ]
  )

  const handleImportAllWorkspaces = useCallback(async () => {
    if (!runtime) return
    const targets = workspaceSections.filter((ws) => ws.available)
    if (targets.length === 0) return

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

    setImportingSection(targets[0]!.sectionId)
    setImportProgress('')

    try {
      const result = await runWithStorageQuiesced(() =>
        importMobileVersionMigrationAllWorkspaces(
          runtime,
          targets.map((ws) => ws.sectionId),
          {
            onProgress: (msg) => setImportProgress(msg),
            legacySourceRoot: customLegacySourceRoot
          }
        )
      )

      if (result.imported > 0) {
        await resyncAfterMigration()
        notifyVersionMigrationComplete()
      } else if (result.skipped > 0) {
        await resyncAfterMigration()
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

      if (!isFailed && (result.imported > 0 || result.skipped > 0)) {
        await promptRestartAfterWorkspaceMigration()
      }

      await refreshScan()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(t('version_migration.import_failed', { error: message }))
    } finally {
      setImportingSection(null)
      setImportProgress('')
    }
  }, [
    customLegacySourceRoot,
    dialog,
    notifyVersionMigrationComplete,
    promptRestartAfterWorkspaceMigration,
    refreshPermission,
    refreshScan,
    resyncAfterMigration,
    runWithStorageQuiesced,
    runtime,
    t,
    toast,
    workspaceSections
  ])

  const legacySourceKindKey =
    legacySourceInfo?.kind === 'manual'
      ? 'version_migration.legacy_source_manual'
      : legacySourceInfo?.kind === 'flutter'
        ? 'version_migration.legacy_source_flutter'
        : legacySourceInfo?.kind === 'migrated'
          ? 'version_migration.legacy_source_migrated'
          : null

  return {
    pageReady,
    scanning,
    scanResult,
    globalSections,
    workspaceSections,
    importingSection,
    importProgress,
    refreshScan,
    handleImportSection,
    handleImportAllWorkspaces,
    allFilesAccessGranted,
    handleRequestAllFilesAccess,
    dbUnavailable,
    customLegacySourceRoot,
    legacySourceKindKey,
    handleChooseLegacyDirectory,
    handleClearCustomLegacyDirectory,
    pickerVisible,
    closeDirectoryPicker,
    handleDirectorySelected,
    fileSystem: services?.fileSystem ?? null
  }
}
