import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog, useToast } from '@baishou/ui'
import { useUserProfileStore } from '@baishou/store'
import type {
  LegacyVersionMigrationImportStatus,
  LegacyVersionMigrationScanResult,
  LegacyVersionMigrationSectionId,
  LegacyVersionMigrationSectionPreview,
  LegacyVersionMigrationSourceKind,
  LegacyVersionMigrationWorkspacePreview
} from '@baishou/shared'

type GlobalSectionUiState = LegacyVersionMigrationSectionPreview & {
  importStatus: LegacyVersionMigrationImportStatus
  failureSamples?: string[]
}

type WorkspaceSectionUiState = LegacyVersionMigrationWorkspacePreview & {
  importStatus: LegacyVersionMigrationImportStatus
  failureSamples?: string[]
}

function mapImportedToStatus(
  sectionId: LegacyVersionMigrationSectionId,
  importedSections: LegacyVersionMigrationSectionId[]
): LegacyVersionMigrationImportStatus {
  return importedSections.includes(sectionId) ? 'success' : 'idle'
}

export function useDesktopVersionMigration() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const api = window.api?.legacyMigration
  const loadProfile = useUserProfileStore((state) => state.loadProfile)

  const [scanResult, setScanResult] = useState<LegacyVersionMigrationScanResult | null>(null)
  const [sourceKind, setSourceKind] = useState<LegacyVersionMigrationSourceKind | null>(null)
  const [customSourceRoot, setCustomSourceRoot] = useState<string | null>(null)
  const [inPlace, setInPlace] = useState(false)
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
  const initialScanDoneRef = useRef(false)

  const refreshScan = useCallback(async () => {
    if (!api) return
    setScanning(true)
    try {
      const payload = await api.scan(customSourceRoot)
      setScanResult(payload.scanResult)
      setSourceKind(payload.sourceKind)
      setCustomSourceRoot(payload.customSourceRoot)
      setInPlace(payload.inPlace)
      const next: Partial<
        Record<LegacyVersionMigrationSectionId, LegacyVersionMigrationImportStatus>
      > = {}
      for (const id of payload.importedSections) {
        next[id] = 'success'
      }
      setSectionStatuses((prev) => ({ ...prev, ...next }))
    } catch (e) {
      toast.showError(
        t('version_migration.scan_failed', {
          error: e instanceof Error ? e.message : String(e),
          defaultValue: `扫描失败：${e instanceof Error ? e.message : String(e)}`
        })
      )
    } finally {
      setScanning(false)
    }
  }, [api, customSourceRoot, t, toast])

  useEffect(() => {
    if (!api || initialScanDoneRef.current) return
    initialScanDoneRef.current = true
    void refreshScan()
  }, [api, refreshScan])

  useEffect(() => {
    if (!api) return
    const unsubscribe = api.onProgress((event) => {
      if (event.message) setImportProgress(event.message)
    })
    return unsubscribe
  }, [api])

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

  const handlePickSource = useCallback(async () => {
    if (!api) return
    try {
      const picked = await api.pickSource()
      if (picked) {
        setCustomSourceRoot(picked)
        await refreshScan()
      }
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : String(e))
    }
  }, [api, refreshScan, toast])

  const handleClearCustomSource = useCallback(async () => {
    if (!api) return
    await api.clearCustomSource()
    setCustomSourceRoot(null)
    await refreshScan()
  }, [api, refreshScan])

  const handleImportSection = useCallback(
    async (sectionId: LegacyVersionMigrationSectionId) => {
      if (!api) return

      if (sectionStatuses[sectionId] === 'success') {
        const proceedAgain = await dialog.confirm(
          t('version_migration.reimport_confirm_message'),
          t('version_migration.reimport_confirm_title', '重复导入')
        )
        if (!proceedAgain) return
      } else {
        const proceed = await dialog.confirm(
          t('version_migration.import_confirm_message'),
          t('version_migration.import_confirm_title', '确认导入')
        )
        if (!proceed) return
      }

      setImportingSection(sectionId)
      setImportProgress('')
      setSectionStatuses((prev) => ({ ...prev, [sectionId]: 'importing' }))

      try {
        const result = await api.importSection(sectionId, customSourceRoot)
        const summary = t('version_migration.import_result_summary', {
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed
        })
        const isFailed = result.failed > 0 && result.imported === 0
        const isPartial = result.failed > 0 && result.imported > 0
        const isCompleted =
          !isFailed &&
          (result.imported > 0 ||
            (result.skipped > 0 &&
              !result.warnings.includes('version_migration.import_section_unavailable') &&
              !result.warnings.includes('version_migration.no_legacy_source')))

        setSectionStatuses((prev) => ({
          ...prev,
          [sectionId]: isFailed ? 'failed' : isCompleted ? 'success' : 'idle'
        }))
        setSectionFailureSamples((prev) => ({
          ...prev,
          [sectionId]: result.failureSamples ?? []
        }))

        if (isFailed) toast.showError(summary)
        else if (isPartial) toast.showWarning(summary)
        else if (result.imported > 0) toast.showSuccess(summary)
        else if (result.skipped > 0) toast.showWarning(t('version_migration.import_nothing_new'))

        if (result.errors?.length) {
          toast.showWarning(
            t('version_migration.import_errors_detail', {
              detail: result.errors.slice(0, 2).join(' · ')
            })
          )
        }
        if (result.failureSamples?.length) {
          toast.showWarning(
            t('version_migration.import_failures_detail', {
              detail: result.failureSamples.slice(0, 3).join(' · '),
              defaultValue: `失败示例：${result.failureSamples.slice(0, 3).join(' · ')}`
            })
          )
        }

        if (
          isCompleted &&
          (sectionId === 'avatar' || sectionId === 'personas' || sectionId === 'config')
        ) {
          await loadProfile()
        }
        await refreshScan()
      } catch (e) {
        setSectionStatuses((prev) => ({ ...prev, [sectionId]: 'failed' }))
        toast.showError(
          t('version_migration.import_failed', {
            error: e instanceof Error ? e.message : String(e)
          })
        )
      } finally {
        setImportingSection(null)
        setImportProgress('')
      }
    },
    [api, customSourceRoot, dialog, loadProfile, refreshScan, sectionStatuses, t, toast]
  )

  const handleImportAllWorkspaces = useCallback(async () => {
    if (!api) return
    const targets = workspaceSections.filter((ws) => ws.available)
    if (targets.length === 0) return

    const proceed = await dialog.confirm(
      t('version_migration.import_all_workspaces_confirm'),
      t('version_migration.import_all_workspaces_title')
    )
    if (!proceed) return

    setImportingSection(targets[0]!.sectionId)
    setImportProgress('')

    try {
      const result = await api.importAllWorkspaces(
        targets.map((ws) => ws.sectionId),
        customSourceRoot
      )
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

      if (isFailed) toast.showError(summary)
      else if (isPartial) toast.showWarning(summary)
      else if (result.imported > 0) toast.showSuccess(summary)
      else if (result.skipped > 0) toast.showWarning(t('version_migration.import_nothing_new'))

      await refreshScan()
    } catch (e) {
      toast.showError(
        t('version_migration.import_failed', {
          error: e instanceof Error ? e.message : String(e)
        })
      )
    } finally {
      setImportingSection(null)
      setImportProgress('')
    }
  }, [api, customSourceRoot, dialog, refreshScan, t, toast, workspaceSections])

  const legacySourceKindKey =
    sourceKind === 'manual'
      ? 'version_migration.legacy_source_manual'
      : sourceKind === 'flutter'
        ? 'version_migration.legacy_source_flutter'
        : sourceKind === 'migrated'
          ? 'version_migration.legacy_source_migrated'
          : null

  return {
    apiAvailable: Boolean(api),
    scanning,
    scanResult,
    globalSections,
    workspaceSections,
    importingSection,
    importProgress,
    customSourceRoot,
    legacySourceKindKey,
    inPlace,
    refreshScan,
    handlePickSource,
    handleClearCustomSource,
    handleImportSection,
    handleImportAllWorkspaces
  }
}
