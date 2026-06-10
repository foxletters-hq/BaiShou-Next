import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '../Toast'
import type {
  ProviderLocalState,
  TtsProviderConfig,
  TTSProviderSettingsProps
} from './tts-provider-settings.types'
import { getInitialConfigs, mergePersistedConfigs } from './tts-provider-settings.defaults'
import { buildInitializedConfigs } from './useTtsProviderSettings.init'

function requiresBaseUrl(providerId: string): boolean {
  return providerId === 'openai-tts' || providerId === 'clone-tts' || providerId === 'gpt-sovits'
}

function buildTtsConfig(
  providerType: string,
  state: ProviderLocalState,
  getProviderName: (type: string) => string,
  defaultMimoVoice: string
): TtsProviderConfig {
  const {
    apiKey,
    baseUrl,
    modelId,
    voice,
    speed,
    responseFormat,
    refAudioPath,
    promptText,
    promptLang,
    textLang
  } = state
  return {
    id: providerType,
    name: getProviderName(providerType),
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey: apiKey.trim(),
    modelId,
    voice:
      voice.trim() ||
      (providerType === 'mimo-tts'
        ? defaultMimoVoice
        : providerType === 'clone-tts' || providerType === 'gpt-sovits'
          ? 'default'
          : 'alloy'),
    speed,
    responseFormat,
    refAudioPath,
    promptText,
    promptLang,
    textLang
  }
}

export function useTtsProviderSettings({
  initialConfig,
  activeProviderId,
  onActiveProviderIdChange,
  persistedConfigs,
  onPersistConfigs,
  providersList,
  onSaveConfig,
  onTestTts,
  onFetchModels,
  onPlayTestAudio,
  autoSaveOnFetchModels
}: Pick<
  TTSProviderSettingsProps,
  | 'initialConfig'
  | 'activeProviderId'
  | 'onActiveProviderIdChange'
  | 'persistedConfigs'
  | 'onPersistConfigs'
  | 'providersList'
  | 'onSaveConfig'
  | 'onTestTts'
  | 'onFetchModels'
  | 'onPlayTestAudio'
  | 'autoSaveOnFetchModels'
>) {
  const { t } = useTranslation()
  const toast = useNativeToast()

  const [providerType, setProviderType] = useState<string>(activeProviderId || 'openai-tts')
  const [configs, setConfigs] = useState<Record<string, ProviderLocalState>>(() =>
    mergePersistedConfigs(persistedConfigs ?? getInitialConfigs())
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [testText, setTestText] = useState(() =>
    t('tts.settings.test_default', '你好，今天过得怎么样？')
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [showAllModelOptions, setShowAllModelOptions] = useState(false)

  const getProviderName = useCallback(
    (type: string) => {
      switch (type) {
        case 'openai-tts':
          return t('tts.settings.provider_openai')
        case 'mimo-tts':
          return t('tts.settings.provider_mimo')
        case 'clone-tts':
          return t('tts.settings.provider_clone')
        case 'gpt-sovits':
          return t('tts.settings.provider_gpt_sovits')
        default:
          return type
      }
    },
    [t]
  )

  const defaultMimoVoice = t('tts.settings.default_voice_mimo', '冰糖')

  const providerOptions = useMemo(
    () => [
      { value: 'openai-tts', label: getProviderName('openai-tts') },
      { value: 'mimo-tts', label: getProviderName('mimo-tts') },
      { value: 'clone-tts', label: getProviderName('clone-tts') },
      { value: 'gpt-sovits', label: getProviderName('gpt-sovits') }
    ],
    [getProviderName]
  )

  const langOptions = useMemo(
    () => [
      { value: 'zh', label: t('tts.settings.lang_zh') },
      { value: 'en', label: t('tts.settings.lang_en') },
      { value: 'ja', label: t('tts.settings.lang_ja') },
      { value: 'ko', label: t('tts.settings.lang_ko') },
      { value: 'yue', label: t('tts.settings.lang_yue') }
    ],
    [t]
  )

  const formatOptions = useMemo(
    () => [
      { value: 'mp3', label: 'MP3' },
      { value: 'wav', label: 'WAV' },
      { value: 'aac', label: 'AAC' }
    ],
    []
  )

  useEffect(() => {
    if (!isInitialized) {
      const base = mergePersistedConfigs(persistedConfigs ?? getInitialConfigs())
      const { configs: merged, providerType: activeType } = buildInitializedConfigs(
        base,
        providersList,
        initialConfig,
        activeProviderId
      )
      setProviderType(activeType)
      setConfigs(merged)
      setIsInitialized(true)
    }
  }, [initialConfig, providersList, isInitialized, persistedConfigs, activeProviderId])

  useEffect(() => {
    if (activeProviderId && activeProviderId !== providerType) {
      setProviderType(activeProviderId)
    }
  }, [activeProviderId, providerType])

  useEffect(() => {
    if (isInitialized) {
      onPersistConfigs?.(configs)
    }
  }, [configs, isInitialized, onPersistConfigs])

  const currentConfig = configs[providerType] || {
    baseUrl: '',
    apiKey: '',
    modelId: '',
    voice: '',
    speed: 1.0,
    responseFormat: 'mp3',
    availableModels: []
  }

  const config = useMemo(
    (): TtsProviderConfig => ({
      id: providerType,
      name: getProviderName(providerType),
      ...currentConfig
    }),
    [providerType, currentConfig, getProviderName]
  )

  const updateCurrentConfig = useCallback(
    (updates: Partial<ProviderLocalState>) => {
      setConfigs((prev) => ({
        ...prev,
        [providerType]: {
          ...prev[providerType],
          ...updates
        }
      }))
    },
    [providerType]
  )

  const handleProviderChange = (id: string) => {
    setProviderType(id)
    setShowApiKey(false)
    setIsModelDropdownOpen(false)
    onActiveProviderIdChange?.(id)
  }

  const getDefaultModelOptions = useCallback(() => {
    if (providerType === 'clone-tts' || providerType === 'gpt-sovits') return ['default']
    if (providerType === 'mimo-tts') return ['mimo-v2.5-tts']
    return ['tts-1', 'tts-1-hd']
  }, [providerType])

  const getModelOptions = useCallback(() => {
    const { modelId, availableModels } = configs[providerType] ?? currentConfig
    const defaults = getDefaultModelOptions()
    const baseOptions = availableModels.length > 0 ? availableModels : defaults
    if (showAllModelOptions || !modelId.trim()) return baseOptions
    const filtered = baseOptions.filter((opt) =>
      opt.toLowerCase().includes(modelId.toLowerCase().trim())
    )
    return filtered.length > 0 ? filtered : baseOptions
  }, [providerType, configs, currentConfig, showAllModelOptions, getDefaultModelOptions])

  const persistCurrentConfig = useCallback(
    async (state: ProviderLocalState) => {
      if (!onSaveConfig) return false
      if (!state.baseUrl.trim() && requiresBaseUrl(providerType)) {
        toast.showError(t('tts.settings.base_url_required'))
        return false
      }
      setSaving(true)
      try {
        await onSaveConfig(buildTtsConfig(providerType, state, getProviderName, defaultMimoVoice))
        toast.showSuccess(t('tts.settings.save_success'))
        return true
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        toast.showError(t('tts.settings.save_failed') + message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [onSaveConfig, providerType, getProviderName, defaultMimoVoice, t, toast]
  )

  const handleFetchModels = useCallback(async () => {
    if (!onFetchModels) return
    const state = configs[providerType]
    const trimmedUrl = state.baseUrl.trim()
    if (!trimmedUrl && requiresBaseUrl(providerType)) {
      toast.showError(t('tts.settings.base_url_required'))
      return
    }
    setLoadingModels(true)
    try {
      const models = await onFetchModels(providerType, state.apiKey.trim(), trimmedUrl)
      if (models.length > 0) {
        const currentModelId = state.modelId?.trim()
        const nextModelId =
          currentModelId && models.includes(currentModelId) ? currentModelId : models[0]
        const nextState: ProviderLocalState = {
          ...state,
          availableModels: models,
          modelId: nextModelId,
          ...(providerType === 'clone-tts' || providerType === 'gpt-sovits'
            ? { voice: nextModelId }
            : {})
        }
        setConfigs((prev) => ({ ...prev, [providerType]: nextState }))
        if (autoSaveOnFetchModels) {
          await persistCurrentConfig(nextState)
        } else {
          toast.showSuccess(t('tts.settings.fetch_models_success'))
        }
      } else {
        toast.showWarning(t('tts.settings.fetch_models_empty'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.fetch_models_failed') + message)
    } finally {
      setLoadingModels(false)
    }
  }, [
    configs,
    providerType,
    onFetchModels,
    autoSaveOnFetchModels,
    persistCurrentConfig,
    t,
    toast
  ])

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (providerType === 'clone-tts' || providerType === 'gpt-sovits') {
        updateCurrentConfig({ modelId, voice: modelId })
      } else {
        updateCurrentConfig({ modelId })
      }
      setIsModelDropdownOpen(false)
    },
    [providerType, updateCurrentConfig]
  )

  const handleSave = async () => {
    await persistCurrentConfig(configs[providerType])
  }

  const handleTest = async () => {
    if (!onTestTts) return
    if (!testText.trim()) {
      toast.showError(t('tts.settings.test_text_required'))
      return
    }
    setTesting(true)
    try {
      const result = await onTestTts(
        buildTtsConfig(providerType, configs[providerType], getProviderName, defaultMimoVoice),
        testText.trim()
      )

      if (result?.success && result.audioBase64) {
        await onPlayTestAudio?.(result.audioBase64, result.format || 'mp3')
        toast.showSuccess(t('tts.settings.test_success'))
      } else {
        const err = result?.message || result?.error ? ` (${result.message ?? result.error})` : ''
        toast.showError(t('tts.settings.test_failed') + err)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.test_error') + message)
    } finally {
      setTesting(false)
    }
  }

  const showSpeedControl =
    providerType === 'openai-tts' || providerType === 'clone-tts' || providerType === 'gpt-sovits'

  const modelPlaceholder =
    providerType === 'clone-tts' || providerType === 'gpt-sovits'
      ? 'default'
      : providerType === 'mimo-tts'
        ? 'mimo-v2.5-tts'
        : 'tts-1'

  const voicePlaceholder =
    providerType === 'clone-tts' || providerType === 'gpt-sovits'
      ? 'default'
      : providerType === 'mimo-tts'
        ? defaultMimoVoice
        : 'alloy'

  return {
    config,
    providerType,
    providerOptions,
    langOptions,
    formatOptions,
    defaultMimoVoice,
    modelPlaceholder,
    voicePlaceholder,
    update: updateCurrentConfig,
    handleProviderChange,
    saving,
    testing,
    loadingModels,
    testText,
    setTestText,
    showApiKey,
    setShowApiKey,
    handleSave,
    handleTest,
    handleFetchModels,
    handleSelectModel,
    getModelOptions,
    isModelDropdownOpen,
    setIsModelDropdownOpen,
    showAllModelOptions,
    setShowAllModelOptions,
    canFetchModels: !!onFetchModels,
    isGptSovits: providerType === 'gpt-sovits',
    showApiKeyField: providerType !== 'clone-tts' && providerType !== 'gpt-sovits',
    apiKeyOptional: providerType === 'openai-tts' || providerType === 'mimo-tts',
    showSpeedControl
  }
}
