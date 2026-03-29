import { z } from 'zod';

export const AgentSessionSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(1),
  vaultName: z.string(),
  assistantId: z.number().int().positive(),
  isPinned: z.boolean().default(false),
  systemPrompt: z.string().optional().nullable(),
  providerId: z.string(),
  modelId: z.string(),
  totalInputTokens: z.number().int().nonnegative().default(0),
  totalOutputTokens: z.number().int().nonnegative().default(0),
  totalCostMicros: z.number().int().nonnegative().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type AgentSession = z.infer<typeof AgentSessionSchema>;

export const AgentMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const AgentMessageSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.number().int().positive(),
  role: AgentMessageRoleSchema,
  isSummary: z.boolean().default(false),
  askId: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  modelId: z.string().optional().nullable(),
  orderIndex: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  costMicros: z.number().int().nonnegative().optional(),
  createdAt: z.date().optional()
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentPartTypeSchema = z.enum(['text', 'tool', 'stepFinish', 'compaction']);

export const AgentPartSchema = z.object({
  id: z.number().int().positive().optional(),
  messageId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  type: AgentPartTypeSchema,
  data: z.any(),
  createdAt: z.date().optional()
});

export type AgentPart = z.infer<typeof AgentPartSchema>;

export const AgentAssistantSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  emoji: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  avatarPath: z.string().optional().nullable(),
  systemPrompt: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  contextWindow: z.number().int().positive().default(10),
  providerId: z.string(),
  modelId: z.string(),
  compressTokenThreshold: z.number().int().positive().default(60000),
  compressKeepTurns: z.number().int().nonnegative().default(3),
  sortOrder: z.number().int().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type AgentAssistant = z.infer<typeof AgentAssistantSchema>;
