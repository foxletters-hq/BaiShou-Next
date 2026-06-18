export interface TtsProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  availableModels?: string[]
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

export interface TTSProviderSettingsProps {
  initialConfig?: Partial<TtsProviderConfig>
  /** 从 global_models 还原的各供应商表单状态 */
  initialProviderStates?: Record<string, ProviderLocalState>
  providersList?: any[]
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: (
    config: TtsProviderConfig,
    text: string
  ) => Promise<{ success: boolean; audioBase64?: string; format?: string }>
  onFetchModels?: (providerId: string, apiKey: string, baseUrl: string) => Promise<string[]>
  /** 桌面端：选择本地参考音频文件 */
  onPickRefAudio?: () => Promise<string | null>
}

export interface ProviderLocalState {
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  availableModels: string[]
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}
