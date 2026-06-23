import { z } from 'zod'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW
} from '../constants/assistant-memory-defaults.constants'

export const AgentSessionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  vaultName: z.string(),
  assistantId: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
  systemPrompt: z.string().optional().nullable(),
  providerId: z.string(),
  modelId: z.string(),
  totalInputTokens: z.number().int().nonnegative().default(0),
  totalOutputTokens: z.number().int().nonnegative().default(0),
  totalCacheReadInputTokens: z.number().int().nonnegative().default(0),
  totalCacheWriteInputTokens: z.number().int().nonnegative().default(0),
  totalCostMicros: z.number().int().nonnegative().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type AgentSession = z.infer<typeof AgentSessionSchema>

export const AgentMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool'])

export const AgentMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: AgentMessageRoleSchema,
  isSummary: z.boolean().default(false),
  askId: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  modelId: z.string().optional().nullable(),
  orderIndex: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadInputTokens: z.number().int().nonnegative().optional(),
  cacheWriteInputTokens: z.number().int().nonnegative().optional(),
  costMicros: z.number().int().nonnegative().optional(),
  createdAt: z.date().optional()
})

export type AgentMessage = z.infer<typeof AgentMessageSchema>

export const AgentPartTypeSchema = z.enum([
  'text',
  'tool',
  'stepFinish',
  'compaction',
  /** 用户上传的图片（独立 part，对齐多模态 user message 结构） */
  'image',
  'attachment',
  'context_snapshot',
  /** BaishouAgentGate 伙伴操作门控（待确认 / 已决议） */
  'agent_gate',
  /** Agent 工作区文件变更（折叠摘要 + 可选 diff） */
  'file_change'
])

export const AgentPartSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  sessionId: z.string(),
  type: AgentPartTypeSchema,
  data: z.any(),
  createdAt: z.date().optional()
})

export type AgentPart = z.infer<typeof AgentPartSchema>

export const AgentAssistantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  emoji: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  avatarPath: z.string().optional().nullable(),
  systemPrompt: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  contextWindow: z
    .number()
    .int()
    .refine((value) => value < 0 || value > 0, {
      message: 'contextWindow must be -1 (unlimited) or a positive integer'
    })
    .default(DEFAULT_ASSISTANT_CONTEXT_WINDOW),
  providerId: z.string(),
  modelId: z.string(),
  compressTokenThreshold: z
    .number()
    .int()
    .nonnegative()
    .default(DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD),
  compressKeepTurns: z.number().int().nonnegative().default(DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS),
  compressSystemPrompt: z.string().optional().nullable(),
  assistantKind: z.enum(['companion', 'work']).default('companion'),
  sortOrder: z.number().int().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type AgentAssistant = z.infer<typeof AgentAssistantSchema>
