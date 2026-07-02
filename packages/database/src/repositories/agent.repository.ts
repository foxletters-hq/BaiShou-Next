import { AgentSession, AgentMessage, AgentPart } from '@baishou/shared'

export interface AgentSessionRepository {
  findById(id: string): Promise<AgentSession | null>
  create(input: Omit<AgentSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentSession>
  updateTokenUsage(
    id: string,
    inputTokens: number,
    outputTokens: number,
    costMicros?: number,
    cacheReadInputTokens?: number,
    cacheWriteInputTokens?: number
  ): Promise<void>
}

export interface AgentMessageRepository {
  findBySessionId(sessionId: string, limit?: number): Promise<AgentMessage[]>
  create(input: Omit<AgentMessage, 'id' | 'createdAt'>): Promise<AgentMessage>
  getPartsByMessageId(messageId: string): Promise<AgentPart[]>
}
