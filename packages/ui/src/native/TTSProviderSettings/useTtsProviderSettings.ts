import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '../Toast'
import type {
  ProviderLocalState,
  TtsProviderConfig,
  TTSProviderSettingsProps
} from './tts-provider-settings.types'
import { getInitialConfigs } from './tts-provider-settings.defaults'
import { buildInitializedConfigs } from './useTtsProviderSettings.init'

const AUTO_SAVE_DEBOUNCE_MS = 500

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
    availableModels,
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
    availableModels,
    refAudioPath,
    promptText,
    promptLang,
    textLang
  }
}

export function useTtsProviderSettings({
  initialConfig,
  initialProviderStates,
  activeProviderId,
  onActiveProviderIdChange,
  onSaveConfig,
  onTestTts,
  onFetchModels,
  onPlayTestAudio
}: Pick<
  TTSProviderSettingsProps,
  | 'initialConfig'
  | 'initialProviderStates'
  | 'activeProviderId'
  | 'onActiveProviderIdChange'
  | 'onSaveConfig'
  | 'onTestTts'
  | 'onFetchModels'
  | 'onPlayTestAudio'
>) {
  const { t } = useTranslation()
  const toast = useNativeToast()

  const [providerType, setProviderType] = useState<string>(activeProviderId || 'openai-tts')
  const [configs, setConfigs] = useState<Record<string, ProviderLocalState>>(getInitialConfigs)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [testText, setTestText] = useState(() =>
    t('tts.settings.test_default', '你好，今天过得怎么样？')
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const skipAutoSaveRef = useRef(true)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
      const { configs: merged, providerType: activeType } = buildInitializedConfigs(
        initialProviderStates,
        initialConfig,
        activeProviderId
      )
      setProviderType(activeType)
      setConfigs(merged)
      setIsInitialized(true)
    }
  }, [initialConfig, initialProviderStates, isInitialized, activeProviderId])

  useEffect(() => {
    if (activeProviderId && activeProviderId !== providerType) {
      setProviderType(activeProviderId)
    }
  }, [activeProviderId, providerType])

  useEffect(() => {
    skipAutoSaveRef.current = true
  }, [providerType])

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
    const { availableModels } = configs[providerType] ?? currentConfig
    const defaults = getDefaultModelOptions()
    return availableModels.length > 0 ? availableModels : defaults
  }, [providerType, configs, currentConfig, getDefaultModelOptions])

  const persistCurrentConfig = useCallback(
    async (state: ProviderLocalState, options?: { silent?: boolean; successMessage?: string }) => {
      if (!onSaveConfig) return false
      if (!state.baseUrl.trim() && requiresBaseUrl(providerType)) {
        if (!options?.silent) {
          toast.showError(t('tts.settings.base_url_required'))
        }
        return false
      }
      setSaving(true)
      try {
        await onSaveConfig(buildTtsConfig(providerType, state, getProviderName, defaultMimoVoice))
        if (options?.successMessage) {
          toast.showSuccess(options.successMessage)
        } else if (!options?.silent) {
          toast.showSuccess(t('tts.settings.save_success'))
        }
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
        skipAutoSaveRef.current = true
        setConfigs((prev) => ({ ...prev, [providerType]: nextState }))
        if (onSaveConfig) {
          await persistCurrentConfig(nextState, {
            silent: true,
            successMessage: t('tts.settings.fetch_models_success')
          })
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
  }, [configs, providerType, onFetchModels, onSaveConfig, persistCurrentConfig, t, toast])

  const handleSelectModel = useCallback(
    (modelId: string) => {
      const updates =
        providerType === 'clone-tts' || providerType === 'gpt-sovits'
          ? { modelId, voice: modelId }
          : { modelId }
      const nextState = { ...configs[providerType], ...updates }
      skipAutoSaveRef.current = true
      updateCurrentConfig(updates)
      setIsModelDropdownOpen(false)
      if (onSaveConfig) {
        void persistCurrentConfig(nextState, { silent: true })
      }
    },
    [providerType, configs, updateCurrentConfig, onSaveConfig, persistCurrentConfig]
  )

  const state = configs[providerType]

  useEffect(() => {
    if (!isInitialized || !onSaveConfig || !state) return
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false
      return
    }

    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      void persistCurrentConfig(state, { silent: true })
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => clearTimeout(autoSaveTimerRef.current)
  }, [
    isInitialized,
    onSaveConfig,
    providerType,
    state?.modelId,
    state?.voice,
    state?.speed,
    state?.responseFormat,
    state?.baseUrl,
    state?.apiKey,
    state?.refAudioPath,
    state?.promptText,
    state?.promptLang,
    state?.textLang,
    persistCurrentConfig
  ])

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
    handleTest,
    handleFetchModels,
    handleSelectModel,
    getModelOptions,
    isModelDropdownOpen,
    setIsModelDropdownOpen,
    canFetchModels: !!onFetchModels,
    isGptSovits: providerType === 'gpt-sovits',
    showApiKeyField: providerType !== 'clone-tts' && providerType !== 'gpt-sovits',
    apiKeyOptional: providerType === 'openai-tts' || providerType === 'mimo-tts',
    showSpeedControl
  }
}
