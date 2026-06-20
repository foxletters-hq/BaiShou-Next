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
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
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
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

export interface TTSProviderSettingsProps {
  initialConfig?: Partial<TtsProviderConfig>
  /** 从 global_models 还原的各供应商表单状态 */
  initialProviderStates?: Record<string, ProviderLocalState>
  /** 从 URL 或路由传入的当前供应商 */
  activeProviderId?: string
  /** 切换供应商时回调（用于更新路由） */
  onActiveProviderIdChange?: (providerId: string) => void
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: (
    config: TtsProviderConfig,
    text: string
  ) => Promise<{
    success: boolean
    message?: string
    audioBase64?: string
    format?: string
    error?: string
  }>
  /** 试听成功后播放音频（移动端 expo-audio） */
  onPlayTestAudio?: (audioBase64: string, format: string) => Promise<void>
  onFetchModels?: (providerId: string, apiKey: string, baseUrl: string) => Promise<string[]>
  /** 桌面/移动端：选择本地参考音频文件 */
  onPickRefAudio?: () => Promise<import('@baishou/shared').TtsRefAudioPickValue | null>
  /** groupCard：卡片内布局，无重复标题与帮助图标（对齐移动端网络搜索设置） */
  layout?: 'section' | 'groupCard'
}
