import { z } from 'zod'

export const AgentRoundCheckpointFileEntrySchema = z.object({
  path: z.string(),
  /** 仅 inline 快照使用；git 快照的正文存在影子仓库的对象库里 */
  beforeContent: z.string().optional(),
  beforeHash: z.string().optional(),
  existed: z.boolean()
})

export type AgentRoundCheckpointFileEntry = z.infer<typeof AgentRoundCheckpointFileEntrySchema>

export const AgentRoundSnapshotKindSchema = z.enum(['git', 'inline'])
export type AgentRoundSnapshotKind = z.infer<typeof AgentRoundSnapshotKindSchema>

export const AgentRoundCheckpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userMessageId: z.string(),
  createdAt: z.string(),
  /** inline 快照的写前正文；git 快照下为空数组，仅历史数据会有内容 */
  files: z.array(AgentRoundCheckpointFileEntrySchema),
  /** 缺省视为 inline，用于兼容影子 Git 之前写下的检查点 */
  snapshotKind: AgentRoundSnapshotKindSchema.optional(),
  /** 本轮写盘前的工作树 tree oid */
  startTreeOid: z.string().optional(),
  /** 本轮结束时的 tree oid，与 startTreeOid 做 diff 即可得到本轮全部改动 */
  endTreeOid: z.string().optional(),
  /** 拍快照时因体积超限未纳入 tree 的路径，回滚时必须原样保留 */
  excludedPaths: z.array(z.string()).optional(),
  /** AI 写工具明确触碰过的路径，用于把回滚范围收敛到「确实是 AI 改的」 */
  touchedPaths: z.array(z.string()).optional()
})

export type AgentRoundCheckpoint = z.infer<typeof AgentRoundCheckpointSchema>

/** attributed=只撤 AI 写工具碰过的路径；all=连同终端命令与外部改动一起撤 */
export type WorkspaceRollbackScope = 'attributed' | 'all'

export interface WorkspaceRollbackPreview {
  snapshotKind: AgentRoundSnapshotKind
  /** 将被撤销的轮次数，大于 1 表示会级联撤掉后续轮次 */
  rounds: number
  /** AI 写工具明确碰过的路径 */
  attributedPaths: string[]
  /** 这几轮里变化了、但不是写工具造成的路径：终端命令的产物，或用户同期的手改 */
  extraPaths: string[]
  /** 快照实现是否支持算出完整改动集；纯文本快照算不出来，extraPaths 恒为空 */
  changedPathsAvailable: boolean
}
