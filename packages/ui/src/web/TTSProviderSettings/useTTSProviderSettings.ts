import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import type { TTSProviderSettingsProps, ProviderLocalState } from './tts-provider-settings.types'
import { getInitialConfigs } from './tts-provider-settings.defaults'
import { buildInitializedConfigs, persistTtsConfigs } from './useTTSProviderSettings.init'
import { useTTSProviderSettingsHandlers } from './useTTSProviderSettings.handlers'

export function useTTSProviderSettings({
  initialConfig,
  providersList,
  onSaveConfig,
  onTestTts,
  onFetchModels
}: TTSProviderSettingsProps) {
  const { t } = useTranslation()
  const toast = useToast()

  const [providerType, setProviderType] = useState<string>('openai-tts')
  const [configs, setConfigs] = useState<Record<string, ProviderLocalState>>(getInitialConfigs)

  const [testText, setTestText] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showAllOptions, setShowAllOptions] = useState(false)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

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

  useEffect(() => {
    if (isInitialized) {
      persistTtsConfigs(configs)
    }
  }, [configs, isInitialized])

  useEffect(() => {
    if (!isInitialized) {
      const { configs: merged, providerType: activeType } = buildInitializedConfigs(
        configs,
        providersList,
        initialConfig
      )
      setProviderType(activeType)
      setConfigs(merged)
      setIsInitialized(true)
    }
  }, [initialConfig, providersList, isInitialized, configs])

  const currentConfig = configs[providerType] || {
    baseUrl: '',
    apiKey: '',
    modelId: '',
    voice: '',
    speed: 1.0,
    responseFormat: 'mp3',
    availableModels: []
  }

  const getProviderName = useCallback(
    (type: string) => {
      switch (type) {
        case 'openai-tts':
          return t('tts.settings.provider_openai', 'OpenAI 兼容 TTS')
        case 'mimo-tts':
          return t('tts.settings.provider_mimo', '小米 MiMo TTS')
        case 'clone-tts':
          return t('tts.settings.provider_clone', 'CloneTTS 本地服务')
        case 'gpt-sovits':
          return t('tts.settings.provider_gpt_sovits', 'GPT-SoVITS 本地服务')
        default:
          return type
      }
    },
    [t]
  )

  const providerOptions = React.useMemo(
    () => [
      { value: 'openai-tts', label: getProviderName('openai-tts') },
      { value: 'mimo-tts', label: getProviderName('mimo-tts') },
      { value: 'clone-tts', label: getProviderName('clone-tts') },
      { value: 'gpt-sovits', label: getProviderName('gpt-sovits') }
    ],
    [getProviderName]
  )

  const langOptions = React.useMemo(
    () => [
      { value: 'zh', label: t('tts.settings.lang_zh', '中文 (zh)') },
      { value: 'en', label: t('tts.settings.lang_en', '英文 (en)') },
      { value: 'ja', label: t('tts.settings.lang_ja', '日文 (ja)') },
      { value: 'ko', label: t('tts.settings.lang_ko', '韩文 (ko)') },
      { value: 'yue', label: t('tts.settings.lang_yue', '粤语 (yue)') }
    ],
    [t]
  )

  const defaultMimoVoice = t('tts.settings.default_voice_mimo', '冰糖')

  const formatOptions = [
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'aac', label: 'AAC' }
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const getModelOptions = useCallback(() => {
    const { modelId, availableModels } = configs[providerType]
    const defaults =
      providerType === 'clone-tts' || providerType === 'gpt-sovits'
        ? ['default']
        : providerType === 'mimo-tts'
          ? ['mimo-v2.5-tts']
          : ['tts-1', 'tts-1-hd']
    const baseOptions = availableModels.length > 0 ? availableModels : defaults
    if (showAllOptions || !modelId.trim()) return baseOptions
    const filtered = baseOptions.filter((opt) =>
      opt.toLowerCase().includes(modelId.toLowerCase().trim())
    )
    return filtered.length > 0 ? filtered : baseOptions
  }, [providerType, configs, showAllOptions])

  const handleSelectModel = useCallback(
    (val: string) => {
      updateCurrentConfig(
        providerType === 'clone-tts' || providerType === 'gpt-sovits'
          ? { modelId: val, voice: val }
          : { modelId: val }
      )
      setIsDropdownOpen(false)
    },
    [updateCurrentConfig, providerType]
  )

  const { handleFetchModels, handleSave, handleTest } = useTTSProviderSettingsHandlers({
    providerType,
    configs,
    testText,
    defaultMimoVoice,
    getProviderName,
    updateCurrentConfig,
    onSaveConfig,
    onTestTts,
    onFetchModels,
    t,
    toast,
    setIsSaving,
    setIsTesting,
    setIsLoadingModels
  })

  const showSpeedControl =
    providerType === 'openai-tts' || providerType === 'clone-tts' || providerType === 'gpt-sovits'

  return {
    t,
    providerType,
    setProviderType,
    configs,
    currentConfig,
    updateCurrentConfig,
    testText,
    setTestText,
    isTesting,
    isSaving,
    isLoadingModels,
    isDropdownOpen,
    setIsDropdownOpen,
    showAllOptions,
    setShowAllOptions,
    comboboxRef,
    showApiKey,
    setShowApiKey,
    providerOptions,
    langOptions,
    defaultMimoVoice,
    formatOptions,
    getModelOptions,
    handleSelectModel,
    handleFetchModels,
    handleSave,
    handleTest,
    showSpeedControl,
    onFetchModels
  }
}

export type TTSProviderSettingsViewModel = ReturnType<typeof useTTSProviderSettings>
