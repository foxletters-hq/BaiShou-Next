import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '../Toast'
import type { TtsProviderConfig, TTSProviderSettingsProps } from './tts-provider-settings.types'
import { DEFAULT_TTS_CONFIG } from './tts-provider-settings.constants'

function requiresBaseUrl(providerId: string): boolean {
  return providerId === 'openai-tts' || providerId === 'clone-tts' || providerId === 'gpt-sovits'
}

export function useTtsProviderSettings({
  initialConfig,
  onSaveConfig,
  onTestTts,
  onFetchModels
}: Pick<
  TTSProviderSettingsProps,
  'initialConfig' | 'onSaveConfig' | 'onTestTts' | 'onFetchModels'
>) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const [config, setConfig] = useState<TtsProviderConfig>({
    ...DEFAULT_TTS_CONFIG,
    ...initialConfig
  })
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [testText, setTestText] = useState('你好，这是 TTS 测试文本。')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const update = (patch: Partial<TtsProviderConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
    setTestResult(null)
  }

  const handleProviderChange = (id: string) => {
    setAvailableModels([])
    update({ id, name: '' })
  }

  const handleFetchModels = useCallback(async () => {
    if (!onFetchModels) return
    const trimmedUrl = config.baseUrl.trim()
    if (!trimmedUrl && requiresBaseUrl(config.id)) {
      toast.showError(t('tts.settings.base_url_required'))
      return
    }
    setLoadingModels(true)
    try {
      const models = await onFetchModels(config.id, config.apiKey.trim(), trimmedUrl)
      if (models.length > 0) {
        setAvailableModels(models)
        toast.showSuccess(t('tts.settings.fetch_models_success'))
      } else {
        toast.showWarning(t('tts.settings.fetch_models_empty'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.fetch_models_failed') + message)
    } finally {
      setLoadingModels(false)
    }
  }, [config.apiKey, config.baseUrl, config.id, onFetchModels, t, toast])

  const getDefaultModelOptions = useCallback(() => {
    if (config.id === 'clone-tts' || config.id === 'gpt-sovits') return ['default']
    if (config.id === 'mimo-tts') return ['mimo-v2.5-tts']
    return ['tts-1', 'tts-1-hd']
  }, [config.id])

  const modelOptions =
    availableModels.length > 0 ? availableModels : getDefaultModelOptions()

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (config.id === 'clone-tts' || config.id === 'gpt-sovits') {
        update({ modelId, voice: modelId })
      } else {
        update({ modelId })
      }
    },
    [config.id]
  )

  const handleSave = async () => {
    if (!onSaveConfig) return
    setSaving(true)
    try {
      await onSaveConfig(config)
      setTestResult(t('common.save_success'))
    } catch {
      setTestResult(t('tts.settings.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!onTestTts || !testText.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTestTts(config, testText)
      setTestResult(
        result.success
          ? (result.message ?? t('tts.settings.test_success'))
          : (result.message ?? t('tts.settings.test_failed'))
      )
    } catch {
      setTestResult(t('tts.settings.test_failed'))
    } finally {
      setTesting(false)
    }
  }

  return {
    config,
    update,
    handleProviderChange,
    saving,
    testing,
    loadingModels,
    testText,
    setTestText,
    testResult,
    showApiKey,
    setShowApiKey,
    handleSave,
    handleTest,
    handleFetchModels,
    handleSelectModel,
    modelOptions,
    canFetchModels: !!onFetchModels,
    speedPercent: Math.round(config.speed * 100),
    isGptSovits: config.id === 'gpt-sovits',
    showApiKeyField: config.id !== 'clone-tts' && config.id !== 'gpt-sovits',
    apiKeyOptional: config.id === 'openai-tts' || config.id === 'mimo-tts'
  }
}
