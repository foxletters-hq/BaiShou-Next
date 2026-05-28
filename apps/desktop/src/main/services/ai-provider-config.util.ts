import {
  AIProviderConfig,
  AiProviderModel,
  ProviderType,
  getDefaultWebSearchMode,
  resolveProviderBaseUrl
} from '@baishou/shared'

const OPENAI_COMPAT_ENV_KEYS = ['OPENAI_API_KEY', 'OPENAI_API_TOKEN', 'OPENAI_KEY'] as const

export type ProviderConfigPatch = Partial<AIProviderConfig> & {
  apiBaseUrl?: string
  enabled?: boolean
}

export function readStoredApiKey(config: AIProviderConfig): string {
  const raw = config as AIProviderConfig & { api_key?: string }
  return (config.apiKey || raw.api_key || '').trim()
}

export function resolveApiKeyForProvider(config: AIProviderConfig): string {
  const stored = readStoredApiKey(config)
  if (stored) return stored

  const type = (config.type || config.id || '').toLowerCase()
  if (
    type === ProviderType.OpenAI ||
    type === 'custom' ||
    type === ProviderType.OpenRouter ||
    type === ProviderType.DeepSeek
  ) {
    for (const envKey of OPENAI_COMPAT_ENV_KEYS) {
      const fromEnv = process.env[envKey]?.trim()
      if (fromEnv) return fromEnv
    }
  }

  if (type === ProviderType.Anthropic) {
    return process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim() || ''
  }

  if (type === ProviderType.Gemini) {
    return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || ''
  }

  return ''
}

export class EmbeddingProviderConfigError extends Error {
  readonly code: 'provider_not_found' | 'api_key_missing'

  constructor(code: 'provider_not_found' | 'api_key_missing', message: string) {
    super(message)
    this.name = 'EmbeddingProviderConfigError'
    this.code = code
  }
}

export function providerRequiresApiKey(type: string): boolean {
  const normalized = type.toLowerCase()
  return normalized !== ProviderType.Ollama && normalized !== ProviderType.LMStudio
}

export function normalizeProviderConfig(config: AIProviderConfig): AiProviderModel {
  const type = (config.type || config.id || ProviderType.OpenAI).toLowerCase() as ProviderType
  return {
    id: config.id,
    name: config.name || config.id,
    type,
    apiKey: resolveApiKeyForProvider(config),
    baseUrl: resolveProviderBaseUrl(config.id, config.type, config.baseUrl),
    models: config.models || [],
    enabledModels: config.enabledModels || [],
    defaultDialogueModel: config.defaultDialogueModel || '',
    defaultNamingModel: config.defaultNamingModel || '',
    isEnabled: config.isEnabled ?? true,
    isSystem: config.isSystem ?? false,
    sortOrder: config.sortOrder ?? 0,
    webSearchMode: getDefaultWebSearchMode(type)
  }
}

export function resolveProviderConfig(
  providers: AIProviderConfig[],
  providerId: string
): AiProviderModel {
  const raw = providers.find((p) => p.id === providerId)
  if (!raw) {
    throw new EmbeddingProviderConfigError(
      'provider_not_found',
      `Embedding provider not found: ${providerId}`
    )
  }

  const normalized = normalizeProviderConfig(raw)
  if (providerRequiresApiKey(normalized.type) && !normalized.apiKey) {
    throw new EmbeddingProviderConfigError(
      'api_key_missing',
      `API key is not configured for provider: ${providerId}`
    )
  }

  return normalized
}

export function patchProviderConfigInStore(
  providers: AIProviderConfig[],
  providerId: string,
  updates: ProviderConfigPatch
): { providers: AIProviderConfig[]; provider: AIProviderConfig } {
  let idx = providers.findIndex((p) => p.id === providerId)
  if (idx < 0) {
    const type = (updates.type || providerId).toLowerCase() as ProviderType
    providers.push({
      id: providerId,
      name: updates.name || providerId.toUpperCase(),
      type,
      apiKey: '',
      baseUrl: updates.apiBaseUrl || updates.baseUrl || '',
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isEnabled: updates.enabled ?? updates.isEnabled ?? true,
      isSystem: updates.isSystem ?? false,
      sortOrder: updates.sortOrder ?? 999
    })
    idx = providers.length - 1
  }

  const current = { ...providers[idx] }

  if (updates.name !== undefined) current.name = updates.name
  if (updates.type !== undefined) current.type = updates.type as AIProviderConfig['type']
  if (updates.isSystem !== undefined) current.isSystem = updates.isSystem
  if (updates.sortOrder !== undefined) current.sortOrder = updates.sortOrder
  if (updates.isEnabled !== undefined) current.isEnabled = updates.isEnabled
  if (updates.enabled !== undefined) current.isEnabled = updates.enabled
  if (updates.apiBaseUrl !== undefined) {
    current.baseUrl = resolveProviderBaseUrl(current.id, current.type, updates.apiBaseUrl)
  }
  if (updates.baseUrl !== undefined) {
    current.baseUrl = resolveProviderBaseUrl(current.id, current.type, updates.baseUrl)
  }
  if (updates.models !== undefined) current.models = updates.models
  if (updates.enabledModels !== undefined) current.enabledModels = updates.enabledModels
  if (updates.defaultDialogueModel !== undefined) {
    current.defaultDialogueModel = updates.defaultDialogueModel
  }
  if (updates.defaultNamingModel !== undefined) {
    current.defaultNamingModel = updates.defaultNamingModel
  }
  if (updates.apiKey !== undefined) {
    const nextKey = String(updates.apiKey).trim()
    if (nextKey || !readStoredApiKey(current)) {
      current.apiKey = updates.apiKey
    }
  }

  providers[idx] = current
  return { providers, provider: current }
}
