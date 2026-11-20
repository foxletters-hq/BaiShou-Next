import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type {
  AssistantKind,
  DeepSeekArchiveScanResult,
  DeepSeekImportProgress,
  DeepSeekImportResult,
  DeepSeekTargetAssistantInput
} from '@baishou/shared'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW,
  DEFAULT_ASSISTANT_KIND,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  filterProvidersForModelSwitcher,
  getDefaultCompressionSystemPrompt
} from '@baishou/shared'
import { useAssistantStore } from '@baishou/store'
import { useToast, type AiProviderModel } from '@baishou/ui'

export type DesktopDeepSeekTargetMode = 'existing' | 'new'

export interface DesktopAssistantItem {
  id: string
  name: string
  description?: string | null
  avatarPath?: string | null
  assistantKind?: AssistantKind | string | null
  sortOrder?: number | null
  isPinned?: boolean | null
}

const DEFAULT_NEW_ASSISTANT_NAME = 'DeepSeek'

export function useDesktopDeepSeekImport() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const api = window.api?.deepseekImport

  const [assistants, setAssistants] = useState<DesktopAssistantItem[]>([])
  const [loadingAssistants, setLoadingAssistants] = useState(true)
  const [chatProviders, setChatProviders] = useState<AiProviderModel[]>([])
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<DeepSeekImportProgress | null>(null)

  const [scanToken, setScanToken] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<Omit<
    DeepSeekArchiveScanResult,
    'payloadDir'
  > | null>(null)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())

  const [targetMode, setTargetMode] = useState<DesktopDeepSeekTargetMode>('existing')
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('')

  const [newAssistantKind, setNewAssistantKind] = useState<AssistantKind>(DEFAULT_ASSISTANT_KIND)
  const [newAssistantName, setNewAssistantName] = useState<string>(DEFAULT_NEW_ASSISTANT_NAME)
  const [newAssistantDescription, setNewAssistantDescription] = useState<string>('')
  const [newAssistantSystemPrompt, setNewAssistantSystemPrompt] = useState<string>('')
  const [newAssistantProviderId, setNewAssistantProviderId] = useState<string | undefined>()
  const [newAssistantModelId, setNewAssistantModelId] = useState<string | undefined>()
  const [newAssistantAvatarPath, setNewAssistantAvatarPath] = useState<string>(
    DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  )

  const [result, setResult] = useState<DeepSeekImportResult | null>(null)

  const scanTokenRef = useRef<string | null>(null)
  scanTokenRef.current = scanToken

  const cleanupCurrentScan = useCallback(async () => {
    const token = scanTokenRef.current
    scanTokenRef.current = null
    if (!api || !token) return
    await api.cleanup(token).catch(() => {})
  }, [api])

  useEffect(() => {
    return () => {
      void cleanupCurrentScan()
    }
  }, [cleanupCurrentScan])

  useEffect(() => {
    if (!api) return
    return api.onProgress((progress) => {
      setImportProgress(progress)
    })
  }, [api])

  const loadAssistants = useCallback(async () => {
    setLoadingAssistants(true)
    try {
      const raw = (await window.api?.getAssistants?.()) as DesktopAssistantItem[] | undefined
      const list = Array.isArray(raw) ? raw : []
      setAssistants(list)
      if (list.length > 0) {
        setSelectedAssistantId((prev) =>
          prev && list.some((a) => a.id === prev) ? prev : list[0]!.id
        )
      } else {
        setSelectedAssistantId('')
        setTargetMode('new')
      }
    } catch {
      setAssistants([])
    } finally {
      setLoadingAssistants(false)
    }
  }, [])

  const reloadChatProviders = useCallback(async (): Promise<AiProviderModel[]> => {
    try {
      const raw = (await window.api?.settings?.getProviders?.()) || []
      const filtered = filterProvidersForModelSwitcher(raw, 'dialogue').map((p) => ({
        id: p.id,
        name: p.name || p.id,
        type: p.type || 'custom',
        models: p.models ?? [],
        enabledModels: p.enabledModels ?? p.models ?? []
      }))
      setChatProviders(filtered)
      return filtered
    } catch {
      setChatProviders([])
      return []
    }
  }, [])

  useEffect(() => {
    void loadAssistants()
    void reloadChatProviders()
  }, [loadAssistants, reloadChatProviders])

  const openModelSwitcher = useCallback(async () => {
    const fresh = await reloadChatProviders()
    if (fresh.length === 0) {
      toast.showError(t('settings.no_models_available', '暂无可用模型'))
      return
    }
    setShowModelSwitcher(true)
  }, [reloadChatProviders, t, toast])

  const clearModelBinding = useCallback(() => {
    setNewAssistantProviderId(undefined)
    setNewAssistantModelId(undefined)
  }, [])

  const handleSelectModel = useCallback((providerId: string, modelId: string) => {
    setNewAssistantProviderId(providerId)
    setNewAssistantModelId(modelId)
    setShowModelSwitcher(false)
  }, [])

  const handleManageProviders = useCallback(() => {
    setShowModelSwitcher(false)
    navigate('/settings/ai-services')
  }, [navigate])

  const handlePickZip = useCallback(async () => {
    if (!api) {
      toast.showError(t('deepseek_import.error_service_unavailable'))
      return
    }

    setScanning(true)
    setResult(null)
    try {
      const payload = await api.pickAndScan(i18n.language)
      if (!payload) return
      setScanToken(payload.scanToken)
      setSelectedFileName(payload.fileName)
      setScanResult(payload.scanResult)
      setSelectedSessionIds(new Set(payload.scanResult.sessions.map((s) => s.sourceId)))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setScanToken(null)
      setSelectedFileName(null)
      setScanResult(null)
      setSelectedSessionIds(new Set())
      toast.showError(t('deepseek_import.error_scan_failed', { error: message }))
    } finally {
      setScanning(false)
    }
  }, [api, i18n.language, t, toast])

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

  const canStartImport = useMemo(() => {
    if (!api || !scanToken || !scanResult || importing || scanning) return false
    if (selectedCount === 0) return false
    if (targetMode === 'existing') return Boolean(selectedAssistantId)
    return Boolean(newAssistantName.trim())
  }, [
    api,
    importing,
    newAssistantName,
    scanResult,
    scanToken,
    scanning,
    selectedAssistantId,
    selectedCount,
    targetMode
  ])

  const handleStartImport = useCallback(async () => {
    if (!api || !scanToken || !scanResult) {
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
        avatarPath: newAssistantAvatarPath,
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
      const importResult = await api.execute({
        scanToken,
        selectedSessionIds: [...selectedSessionIds],
        target
      })
      setResult(importResult)
      setScanToken(null)
      setScanResult(null)
      setSelectedFileName(null)
      setSelectedSessionIds(new Set())
      await Promise.all([loadAssistants(), useAssistantStore.getState().fetchAssistants()])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('deepseek_import.error_import_failed', { error: message }))
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }, [
    api,
    assistants,
    i18n.language,
    loadAssistants,
    newAssistantAvatarPath,
    newAssistantDescription,
    newAssistantKind,
    newAssistantModelId,
    newAssistantName,
    newAssistantProviderId,
    newAssistantSystemPrompt,
    scanResult,
    scanToken,
    selectedAssistantId,
    selectedSessionIds,
    t,
    targetMode,
    toast
  ])

  const handleOpenImportedAssistant = useCallback(() => {
    if (!result) return
    const query = `?assistantId=${encodeURIComponent(result.assistantId)}`
    if (result.firstImportedSessionId) {
      navigate(`/chat/${encodeURIComponent(result.firstImportedSessionId)}${query}`)
    } else {
      navigate(`/chat${query}`)
    }
  }, [navigate, result])

  const handleReset = useCallback(() => {
    setResult(null)
    setScanResult(null)
    setSelectedFileName(null)
    setSelectedSessionIds(new Set())
    void cleanupCurrentScan()
    setScanToken(null)
  }, [cleanupCurrentScan])

  return {
    apiAvailable: Boolean(api),
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
    newAssistantAvatarPath,
    setNewAssistantAvatarPath,
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
