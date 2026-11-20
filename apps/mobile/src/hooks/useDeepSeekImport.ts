import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import type {
  DeepSeekArchiveScanResult,
  DeepSeekImportProgress,
  DeepSeekImportResult,
  DeepSeekTargetAssistantInput
} from '@baishou/core-mobile'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW,
  DEFAULT_ASSISTANT_KIND,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  filterProvidersForModelSwitcher,
  getDefaultCompressionSystemPrompt,
  logger,
  type AIProviderConfig,
  type AssistantKind,
  type ModelSwitcherProvider
} from '@baishou/shared'
import { useAgentNavigationStore } from '@baishou/store'
import {
  launchAvatarImageLibraryAsync,
  requestAvatarLibraryPermission,
  useNativeToast
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import {
  listAssistantsForUi,
  sortAssistantsByOrder,
  type MobileAssistantUi
} from '../lib/mobile-assistant.util'
import { writeAgentNavigationSnapshot } from '../lib/agent-navigation-persistence'
import {
  executeMobileDeepSeekImport,
  extractAndScanMobileDeepSeekZip
} from '../services/mobile-deepseek-import.service'

export type DeepSeekTargetMode = 'existing' | 'new'

const DEFAULT_NEW_ASSISTANT_NAME = 'DeepSeek'

export function useDeepSeekImport() {
  const { t, i18n } = useTranslation()
  const toast = useNativeToast()
  const router = useRouter()
  const { services, dbReady, vaultRevision } = useBaishou()

  const [assistants, setAssistants] = useState<MobileAssistantUi[]>([])
  const [loadingAssistants, setLoadingAssistants] = useState(true)
  const [chatProviders, setChatProviders] = useState<ModelSwitcherProvider[]>([])
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<DeepSeekImportProgress | null>(null)

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<DeepSeekArchiveScanResult | null>(null)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())

  const [targetMode, setTargetMode] = useState<DeepSeekTargetMode>('existing')
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('')

  // 新建伙伴表单状态（与正常新建伙伴页 useAssistantEditForm 保持一致）
  const [newAssistantKind, setNewAssistantKind] = useState<AssistantKind>(DEFAULT_ASSISTANT_KIND)
  const [newAssistantName, setNewAssistantName] = useState<string>(DEFAULT_NEW_ASSISTANT_NAME)
  const [newAssistantDescription, setNewAssistantDescription] = useState<string>('')
  const [newAssistantSystemPrompt, setNewAssistantSystemPrompt] = useState<string>('')
  const [newAssistantProviderId, setNewAssistantProviderId] = useState<string | undefined>()
  const [newAssistantModelId, setNewAssistantModelId] = useState<string | undefined>()
  const [newAssistantStoredAvatarPath, setNewAssistantStoredAvatarPath] = useState<string>(
    DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  )
  const [newAssistantPreviewAvatarUri, setNewAssistantPreviewAvatarUri] = useState<string | null>(
    null
  )
  const [newAssistantPendingAvatarUri, setNewAssistantPendingAvatarUri] = useState<string | null>(
    null
  )

  const [result, setResult] = useState<DeepSeekImportResult | null>(null)

  const cleanupRef = useRef<(() => Promise<void>) | null>(null)

  const runCleanup = useCallback(async () => {
    const fn = cleanupRef.current
    cleanupRef.current = null
    if (fn) {
      await fn().catch(() => {})
    }
  }, [])

  useEffect(() => {
    return () => {
      void runCleanup()
    }
  }, [runCleanup])

  const reloadChatProviders = useCallback(async (): Promise<ModelSwitcherProvider[]> => {
    if (!dbReady || !services) return []
    try {
      const list = (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      const filtered = filterProvidersForModelSwitcher(list, 'dialogue')
      setChatProviders(filtered)
      return filtered
    } catch {
      setChatProviders([])
      return []
    }
  }, [dbReady, services])

  useEffect(() => {
    void reloadChatProviders()
  }, [reloadChatProviders])

  useFocusEffect(
    useCallback(() => {
      void reloadChatProviders()
    }, [reloadChatProviders])
  )

  useEffect(() => {
    if (!dbReady || !services) return
    let cancelled = false
    setLoadingAssistants(true)
    void (async () => {
      try {
        const list = await listAssistantsForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem,
          { preferFileUri: true }
        )
        const sorted = sortAssistantsByOrder(list)
        if (cancelled) return
        setAssistants(sorted)
        if (sorted.length > 0) {
          setSelectedAssistantId((prev) =>
            prev && sorted.some((a) => a.id === prev) ? prev : sorted[0]!.id
          )
        } else {
          setSelectedAssistantId('')
          setTargetMode('new')
        }
      } catch {
        if (!cancelled) {
          setAssistants([])
        }
      } finally {
        if (!cancelled) setLoadingAssistants(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dbReady, services, vaultRevision])

  const handleSelectBuiltinAvatar = useCallback((avatarPath: string) => {
    setNewAssistantPendingAvatarUri(null)
    setNewAssistantPreviewAvatarUri(null)
    setNewAssistantStoredAvatarPath(avatarPath)
  }, [])

  const handlePickAvatarImage = useCallback(async () => {
    try {
      if (!(await requestAvatarLibraryPermission())) {
        toast.showError(t('profile.image_pick_permission'))
        return
      }
      const picked = await launchAvatarImageLibraryAsync()
      if (!picked.canceled && picked.assets[0]) {
        const uri = picked.assets[0].uri
        setNewAssistantPendingAvatarUri(uri)
        setNewAssistantPreviewAvatarUri(uri)
        setNewAssistantStoredAvatarPath(uri)
      }
    } catch {
      toast.showError(t('profile.image_pick_error'))
    }
  }, [t, toast])

  const clearModelBinding = useCallback(() => {
    setNewAssistantProviderId(undefined)
    setNewAssistantModelId(undefined)
  }, [])

  const openModelSwitcher = useCallback(async () => {
    const fresh = await reloadChatProviders()
    if (fresh.length === 0) {
      toast.showError(t('settings.no_models_available'))
      return
    }
    setShowModelSwitcher(true)
  }, [reloadChatProviders, t, toast])

  const handleSelectModel = useCallback((pid: string, mid: string) => {
    setNewAssistantProviderId(pid)
    setNewAssistantModelId(mid)
    setShowModelSwitcher(false)
  }, [])

  const handleManageProviders = useCallback(() => {
    setShowModelSwitcher(false)
    router.push('/settings/ai-services')
  }, [router])

  const handlePickZip = useCallback(async () => {
    if (!services || !dbReady) {
      toast.showError(t('deepseek_import.error_service_unavailable'))
      return
    }

    let pick: DocumentPicker.DocumentPickerResult
    try {
      logger.info('[DeepSeekImport] pick:start')
      pick = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        copyToCacheDirectory: true
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('[DeepSeekImport] pick:failed', { error: message })
      toast.showError(t('deepseek_import.error_scan_failed', { error: message }))
      return
    }

    if (pick.canceled || !pick.assets?.[0]?.uri) {
      logger.info('[DeepSeekImport] pick:canceled')
      return
    }

    const asset = pick.assets[0]
    logger.info('[DeepSeekImport] pick:selected', {
      name: asset.name ?? null,
      size: asset.size ?? null,
      mimeType: asset.mimeType ?? null
    })
    setScanning(true)
    setResult(null)
    await runCleanup()

    try {
      const handle = await extractAndScanMobileDeepSeekZip(services.fileSystem, asset.uri)
      cleanupRef.current = handle.cleanup
      setSelectedFileName(asset.name || 'deepseek_data.zip')
      setScanResult(handle.scanResult)
      setSelectedSessionIds(new Set(handle.scanResult.sessions.map((s) => s.sourceId)))
      logger.info('[DeepSeekImport] scan:done', {
        format: handle.scanResult.format,
        sessions: handle.scanResult.sessions.length,
        totalMessages: handle.scanResult.totalMessages
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('[DeepSeekImport] scan:failed', { error: message })
      setScanResult(null)
      setSelectedFileName(null)
      setSelectedSessionIds(new Set())
      toast.showError(t('deepseek_import.error_scan_failed', { error: message }))
    } finally {
      setScanning(false)
    }
  }, [dbReady, runCleanup, services, t, toast])

  const handleToggleSession = useCallback((sourceId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (!scanResult) return
    setSelectedSessionIds((prev) => {
      if (prev.size === scanResult.sessions.length) {
        return new Set()
      }
      return new Set(scanResult.sessions.map((s) => s.sourceId))
    })
  }, [scanResult])

  const selectedCount = selectedSessionIds.size
  const totalCount = scanResult?.sessions.length ?? 0

  const canStartImport = useMemo(() => {
    if (!dbReady || !services || !scanResult || importing || scanning) return false
    if (selectedCount === 0) return false
    if (targetMode === 'existing') return Boolean(selectedAssistantId)
    return Boolean(newAssistantName.trim())
  }, [
    dbReady,
    importing,
    newAssistantName,
    scanResult,
    scanning,
    selectedAssistantId,
    selectedCount,
    services,
    targetMode
  ])

  const handleStartImport = useCallback(async () => {
    if (!services || !dbReady || !scanResult) {
      toast.showError(t('deepseek_import.error_service_unavailable'))
      return
    }
    if (selectedSessionIds.size === 0) {
      toast.showError(t('deepseek_import.error_select_session'))
      return
    }

    let target: DeepSeekTargetAssistantInput
    if (targetMode === 'existing') {
      const chosen = assistants.find((a) => a.id === selectedAssistantId)
      if (!chosen) {
        toast.showError(t('deepseek_import.error_select_assistant'))
        return
      }
      target = {
        mode: 'existing',
        assistantId: chosen.id,
        assistantName: chosen.name
      }
    } else {
      const trimmed = newAssistantName.trim()
      if (!trimmed) {
        toast.showError(t('deepseek_import.error_name_required'))
        return
      }
      target = {
        mode: 'new',
        name: trimmed,
        description: newAssistantDescription.trim() || undefined,
        systemPrompt: newAssistantSystemPrompt.trim() || undefined,
        providerId: newAssistantProviderId || null,
        modelId: newAssistantModelId || null,
        avatarPath: newAssistantStoredAvatarPath,
        assistantKind: newAssistantKind,
        contextWindow: DEFAULT_ASSISTANT_CONTEXT_WINDOW,
        compressTokenThreshold: DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
        compressKeepTurns: DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
        compressSystemPrompt: getDefaultCompressionSystemPrompt(i18n.language)
      }
    }

    setImporting(true)
    setImportProgress({ phase: 'preparing', current: 0, total: selectedSessionIds.size })

    try {
      const importResult = await executeMobileDeepSeekImport(services, {
        scanResult,
        selectedSessionIds: [...selectedSessionIds],
        target,
        pendingAvatarImportUri: target.mode === 'new' ? newAssistantPendingAvatarUri : null,
        onProgress: (p) => setImportProgress(p)
      })
      setResult(importResult)
      await runCleanup()
      setScanResult(null)
      setSelectedSessionIds(new Set())
      setSelectedFileName(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('deepseek_import.error_import_failed', { error: message }))
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }, [
    assistants,
    dbReady,
    i18n.language,
    newAssistantDescription,
    newAssistantKind,
    newAssistantModelId,
    newAssistantName,
    newAssistantPendingAvatarUri,
    newAssistantProviderId,
    newAssistantStoredAvatarPath,
    newAssistantSystemPrompt,
    runCleanup,
    scanResult,
    selectedAssistantId,
    selectedSessionIds,
    services,
    t,
    targetMode,
    toast
  ])

  const handleOpenImportedAssistant = useCallback(async () => {
    if (!services || !result) return
    try {
      const vaultKey = await services.pathService.getActiveVaultNameForContext()
      const snapshot = {
        assistantId: result.assistantId,
        sessionId: result.firstImportedSessionId
      }
      useAgentNavigationStore.getState().setContext(vaultKey, snapshot)
      await writeAgentNavigationSnapshot(vaultKey, snapshot)
    } catch {
      // 导航快照写失败不阻断跳转
    }
    router.replace('/(tabs)/agent')
  }, [result, router, services])

  const handleReset = useCallback(() => {
    setResult(null)
    setScanResult(null)
    setSelectedFileName(null)
    setSelectedSessionIds(new Set())
    void runCleanup()
  }, [runCleanup])

  return {
    dbReady,
    assistants,
    loadingAssistants,
    chatProviders,
    showModelSwitcher,
    setShowModelSwitcher,
    scanning,
    importing,
    importProgress,
    selectedFileName,
    scanResult,
    selectedSessionIds,
    selectedCount,
    totalCount,
    targetMode,
    setTargetMode,
    selectedAssistantId,
    setSelectedAssistantId,
    newAssistantKind,
    setNewAssistantKind,
    newAssistantName,
    setNewAssistantName,
    newAssistantDescription,
    setNewAssistantDescription,
    newAssistantSystemPrompt,
    setNewAssistantSystemPrompt,
    newAssistantProviderId,
    newAssistantModelId,
    newAssistantStoredAvatarPath,
    newAssistantPreviewAvatarUri,
    handleSelectBuiltinAvatar,
    handlePickAvatarImage,
    clearModelBinding,
    openModelSwitcher,
    handleSelectModel,
    handleManageProviders,
    result,
    canStartImport,
    handlePickZip,
    handleToggleSession,
    handleToggleSelectAll,
    handleStartImport,
    handleOpenImportedAssistant,
    handleReset
  }
}
