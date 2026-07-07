import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { isLegacyAppRoot, normalizeImportedSectionIds } from '@baishou/core-mobile'
import type {
  LegacyVersionMigrationImportStatus,
  LegacyVersionMigrationScanResult,
  LegacyVersionMigrationSectionId,
  LegacyVersionMigrationSectionPreview,
  LegacyVersionMigrationWorkspacePreview
} from '@baishou/core-mobile'
import { useBaishou } from '../providers/BaishouProvider'
import {
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
import {
  runVersionMigrationAllWorkspacesImport,
  runVersionMigrationSectionImport
} from './version-migration-import.handlers'

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
    notifyVersionMigrationComplete
  } = useBaishou()

  const [pageReady, setPageReady] = useState(false)
  const [scanResult, setScanResult] = useState<LegacyVersionMigrationScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [importingSection, setImportingSection] = useState<LegacyVersionMigrationSectionId | null>(
    null
  )
  const [importBusy, setImportBusy] = useState(false)
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
      if (!result) return
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

  const buildImportDeps = useCallback(
    () => ({
      runtime: runtime!,
      t,
      toast,
      dialog,
      customLegacySourceRoot,
      sectionStatuses,
      workspaceSectionIds: workspaceSections.filter((ws) => ws.available).map((ws) => ws.sectionId),
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
    }),
    [
      customLegacySourceRoot,
      dialog,
      notifyVersionMigrationComplete,
      promptRestartAfterWorkspaceMigration,
      refreshPermission,
      refreshScan,
      runWithStorageQuiesced,
      runtime,
      sectionStatuses,
      services,
      t,
      toast,
      workspaceSections
    ]
  )

  const handleImportSection = useCallback(
    async (sectionId: LegacyVersionMigrationSectionId) => {
      if (!runtime) return
      await runVersionMigrationSectionImport(
        buildImportDeps() as import('./version-migration-import.handlers').VersionMigrationImportDeps,
        sectionId
      )
    },
    [buildImportDeps, runtime]
  )

  const handleImportAllWorkspaces = useCallback(async () => {
    if (!runtime) return
    await runVersionMigrationAllWorkspacesImport(
      buildImportDeps() as import('./version-migration-import.handlers').VersionMigrationImportDeps
    )
  }, [buildImportDeps, runtime])

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
    importBusy,
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
