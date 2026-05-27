import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type {
  TtsProviderConfig,
  ProviderLocalState,
  TTSProviderSettingsProps
} from './tts-provider-settings.types'
import type { useToast } from '../Toast/useToast'

type HandlerDeps = {
  providerType: string
  configs: Record<string, ProviderLocalState>
  testText: string
  defaultMimoVoice: string
  getProviderName: (type: string) => string
  updateCurrentConfig: (updates: Partial<ProviderLocalState>) => void
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: TTSProviderSettingsProps['onTestTts']
  onFetchModels?: TTSProviderSettingsProps['onFetchModels']
  t: TFunction
  toast: ReturnType<typeof useToast>
  setIsSaving: (v: boolean) => void
  setIsTesting: (v: boolean) => void
  setIsLoadingModels: (v: boolean) => void
}

function requiresBaseUrl(providerType: string): boolean {
  return (
    providerType === 'openai-tts' || providerType === 'clone-tts' || providerType === 'gpt-sovits'
  )
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

export function useTTSProviderSettingsHandlers(deps: HandlerDeps) {
  const {
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
  } = deps

  const handleFetchModels = useCallback(async () => {
    const { apiKey, baseUrl } = configs[providerType]
    const trimmedUrl = baseUrl.trim()
    if (!trimmedUrl && requiresBaseUrl(providerType)) {
      toast.showError(t('tts.settings.base_url_required', '请填写 Base URL'))
      return
    }
    setIsLoadingModels(true)
    try {
      if (onFetchModels) {
        const models = await onFetchModels(providerType, apiKey.trim(), trimmedUrl)
        if (models && models.length > 0) {
          updateCurrentConfig({ availableModels: models })
          toast.showSuccess(t('tts.settings.fetch_models_success', '成功获取模型列表'))
        } else {
          toast.showWarning(t('tts.settings.fetch_models_empty', '未获取到可用模型'))
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.fetch_models_failed', '获取模型失败: ') + message)
    } finally {
      setIsLoadingModels(false)
    }
  }, [providerType, configs, onFetchModels, updateCurrentConfig, t, toast, setIsLoadingModels])

  const handleSave = useCallback(async () => {
    const state = configs[providerType]
    if (!state.baseUrl.trim() && requiresBaseUrl(providerType)) {
      toast.showError(t('tts.settings.base_url_required', '请填写 Base URL'))
      return
    }

    setIsSaving(true)
    try {
      await onSaveConfig?.(buildTtsConfig(providerType, state, getProviderName, defaultMimoVoice))
      toast.showSuccess(t('tts.settings.save_success', 'TTS 配置已保存'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.save_failed', '保存失败: ') + message)
    } finally {
      setIsSaving(false)
    }
  }, [
    providerType,
    configs,
    onSaveConfig,
    getProviderName,
    defaultMimoVoice,
    t,
    toast,
    setIsSaving
  ])

  const handleTest = useCallback(async () => {
    if (!testText.trim()) {
      toast.showError(t('tts.settings.test_text_required', '请输入测试文本'))
      return
    }

    setIsTesting(true)
    try {
      const result = await onTestTts?.(
        buildTtsConfig(providerType, configs[providerType], getProviderName, defaultMimoVoice),
        testText.trim()
      )

      if (result?.success && result.audioBase64) {
        const audio = new Audio(`data:audio/${result.format || 'mp3'};base64,${result.audioBase64}`)
        await audio.play()
        toast.showSuccess(t('tts.settings.test_success', '测试成功，正在播放'))
      } else {
        const err = result && 'error' in result ? ` (${(result as { error?: string }).error})` : ''
        toast.showError(t('tts.settings.test_failed', '测试失败') + err)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('tts.settings.test_error', '测试出错: ') + message)
    } finally {
      setIsTesting(false)
    }
  }, [
    providerType,
    configs,
    testText,
    onTestTts,
    getProviderName,
    defaultMimoVoice,
    t,
    toast,
    setIsTesting
  ])

  return { handleFetchModels, handleSave, handleTest }
}
