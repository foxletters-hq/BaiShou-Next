import { z } from 'zod'

export const AgentRoundCheckpointFileEntrySchema = z.object({
  path: z.string(),
  beforeContent: z.string().optional(),
  beforeHash: z.string().optional(),
  existed: z.boolean()
})

export type AgentRoundCheckpointFileEntry = z.infer<typeof AgentRoundCheckpointFileEntrySchema>

export const AgentRoundCheckpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userMessageId: z.string(),
  createdAt: z.string(),
  files: z.array(AgentRoundCheckpointFileEntrySchema)
})

export type AgentRoundCheckpoint = z.infer<typeof AgentRoundCheckpointSchema>
