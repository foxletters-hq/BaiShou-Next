export interface InsertSessionInput {
  id: string
  title?: string
  vaultName: string
  assistantId?: string
  systemPrompt?: string
  providerId: string
  modelId: string
}

export interface InsertMessageInput {
  id: string
  sessionId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  isSummary?: boolean
  orderIndex: number
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  providerId?: string
  modelId?: string
}

export interface InsertPartInput {
  id: string
  messageId: string
  sessionId: string
  type: 'text' | 'tool' | 'stepFinish' | 'compaction'
  data: any
}
