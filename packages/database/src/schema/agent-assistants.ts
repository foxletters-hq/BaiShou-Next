import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

/**
 * AI 伙伴表 — 像素级对齐原版 `AgentAssistants` Drift 表定义
 *
 * - contextWindow 默认 -1（无限轮数）
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
  /** 发送给模型的历史消息条数；-1 表示不限制 */
  contextWindow: integer('context_window').notNull().default(-1),
  /** 绑定的供应商 ID（nullable，null 时使用全局模型） */
  providerId: text('provider_id'),
  /** 绑定的模型 ID（nullable，null 时使用全局模型） */
  modelId: text('model_id'),
  /** 会话压缩阈值 (token 数，0=关闭) */
  compressTokenThreshold: integer('compress_token_threshold').notNull().default(150_000),
  /** 压缩后保留的最近轮数 */
  compressKeepTurns: integer('compress_keep_turns').notNull().default(3),
  /** 覆盖模型上下文窗口（token）；null 则按 modelId 查表 */
  compressModelContextWindow: integer('compress_model_context_window'),
  /** 保留区 token 预算；null 则按窗口 25% 自动计算 */
  compressPreserveRecentTokens: integer('compress_preserve_recent_tokens'),
  /** 压缩时发给模型的系统提示词（null 则用当前语言默认） */
  compressSystemPrompt: text('compress_system_prompt'),
  /** 伙伴类型：companion=亲密伙伴，work=工作伙伴 */
  assistantKind: text('assistant_kind').notNull().default('companion'),
  /** 绑定的表情包组 ID（nullable，旧版单组） */
  emojiGroupId: text('emoji_group_id'),
  /** 伙伴是否启用表情包（默认关闭） */
  emojiEnabled: integer('emoji_enabled', { mode: 'boolean' }).notNull().default(false),
  /** 伙伴可用的表情包组 ID 列表（JSON 字符串数组） */
  emojiGroupIds: text('emoji_group_ids'),
  /** 拖动排序权重 */
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
})
