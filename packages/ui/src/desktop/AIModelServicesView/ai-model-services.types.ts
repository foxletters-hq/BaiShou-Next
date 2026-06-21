export interface AIProviderConfig {
  providerId: string
  name?: string
  type?: string
  isSystem?: boolean
  sortOrder?: number
  enabled: boolean
  apiKey: string
  apiBaseUrl?: string
  models?: string[]
  enabledModels?: string[]
  defaultDialogueModel?: string
}

export interface AIModelServicesViewProps {
  providers: Record<string, AIProviderConfig>
  onUpdateProvider: (providerId: string, updates: Partial<AIProviderConfig>) => void | Promise<void>
  onDeleteProvider?: (providerId: string) => void
  onReorderProviders?: (orderedIds: string[]) => void
  onTestConnection?: (
    providerId: string,
    tempKey?: string,
    tempUrl?: string,
    testModelId?: string
  ) => Promise<void>
  onFetchModels?: (providerId: string, tempKey?: string, tempUrl?: string) => Promise<string[]>
}
