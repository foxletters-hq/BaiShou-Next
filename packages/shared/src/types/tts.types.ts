export interface TtsSynthesizeRequest {
  text: string
  modelId: string
  settings: TtsProviderSettings
}

export interface TtsSynthesizeResponse {
  audioBase64: string
  format: string
}

export interface TtsProviderSettings {
  voice: string
  speed?: number
  responseFormat: string
  [key: string]: unknown
}

export interface TtsProviderConfig {
  baseUrl: string
  apiKey: string
}

export interface TtsProvider {
  readonly id: string
  readonly name: string
  supportsModel(modelId: string): boolean
  synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse>
}

export interface TtsSettings {
  voice: string
  speed: number
  responseFormat: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}
