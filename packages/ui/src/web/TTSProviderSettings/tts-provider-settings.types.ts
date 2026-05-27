export interface TtsProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

export interface TTSProviderSettingsProps {
  initialConfig?: Partial<TtsProviderConfig>
  providersList?: any[]
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: (
    config: TtsProviderConfig,
    text: string
  ) => Promise<{ success: boolean; audioBase64?: string; format?: string }>
  onFetchModels?: (providerId: string, apiKey: string, baseUrl: string) => Promise<string[]>
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
