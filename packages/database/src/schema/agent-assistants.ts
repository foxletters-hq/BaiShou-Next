import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * AI 伙伴表 — 像素级对齐原版 `AgentAssistants` Drift 表定义
 *
 * - contextWindow 默认 20（对齐原版）
 * - providerId / modelId 均为 nullable（对齐原版，null 时使用全局模型）
 * - description 有空字符串默认值
 */
export const agentAssistantsTable = sqliteTable('agent_assistants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji'),
  description: text('description').default(''),
  avatarPath: text('avatar_path'),
  systemPrompt: text('system_prompt').default(''),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  /** 发送给模型的历史消息条数，默认 20 对齐原版 */
  contextWindow: integer('context_window').notNull().default(20),
  /** 绑定的供应商 ID（nullable，null 时使用全局模型） */
  providerId: text('provider_id'),
  /** 绑定的模型 ID（nullable，null 时使用全局模型） */
  modelId: text('model_id'),
  /** 会话压缩阈值 (token 数，0=关闭) */
  compressTokenThreshold: integer('compress_token_threshold').notNull().default(60000),
  /** 压缩后保留的最近轮数 */
  compressKeepTurns: integer('compress_keep_turns').notNull().default(3),
  /** 拖动排序权重 */
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
});
