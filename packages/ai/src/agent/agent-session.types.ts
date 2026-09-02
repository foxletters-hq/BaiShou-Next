import { IAIProvider } from '../providers/provider.interface'
import { ToolRegistry } from '../tools/tool-registry'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import type { AgentSessionKind, BaishouAgentGateConfig, FileChangePartData } from '@baishou/shared'
import type { AgentRoundCheckpointService } from '../agent-workspace/agent-round-checkpoint.service'
import type { WorkspaceFsAdapter } from '../agent-workspace/workspace-fs'
import { SessionRepository } from '@baishou/database'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'

export interface AttachmentInput {
  type: 'image' | 'file'
  url?: string
  data?: string // base64
  mimeType?: string
  name?: string
  isText?: boolean
  textContent?: string
  isImage?: boolean
  isPdf?: boolean
  filePath?: string
}

export interface StreamChatOptions {
  sessionId: string
  userText: string
  provider: IAIProvider
  modelId: string
  toolRegistry: ToolRegistry
  sessionRepo: SessionRepository
  snapshotRepo: SnapshotRepository
  systemPrompt?: string
  userConfig?: Record<string, unknown>
  attachments?: AttachmentInput[]
  contextSnapshots?: { title?: string; content: string }[]
  systemModels?: {
    namingProvider?: IAIProvider
    namingModelId?: string
    namingModelConfigured?: boolean
    summaryProvider?: IAIProvider
    summaryModelId?: string
    embeddingProvider?: IAIProvider
    embeddingModelId?: string
  }
  diarySearcher?: import('../tools/agent.tool').ToolDiarySearcher
  webSearchResultFetcher?: (url: string) => Promise<string>
  fetchSearchPage?: (url: string) => Promise<string>
  abortSignal?: AbortSignal
  /** 会话流 claim 代数；被新流取代时跳过落盘，避免快速重试产生重复 assistant 消息 */
  streamClaimGeneration?: number
  userMessageId?: string // 明确指定回复针对的用户消息 ID
  skipUserMessageRecording?: boolean // 用户消息已提前落库时，跳过重复记录
  forceRecompress?: boolean // 编辑/重发截断后允许重新判定压缩（截断已清除 marker/无效快照）
  /** 修剪 tool payload 后写回外部 session JSON */
  flushSessionToDisk?: (sessionId: string) => Promise<void>
  /** Inject a shared gate; otherwise created per stream from userConfig */
  agentGate?: IBaishouAgentGate
  /** Persist allowlist / config mutations after gate "always" replies */
  persistBaishouAgentGateConfig?: (config: BaishouAgentGateConfig) => Promise<void>
  /** Memory/Graph JSONL write facade */
  rawDataSourceManager?: import('@baishou/shared').ToolRawDataSourceManager
  /** Host hook: Graph JSONL → SQLite pending-index sync */
  syncGraphPendingIndex?: () => Promise<void>
  /** Host hook: remove a life-graph node or edge from JSONL and SQLite together */
  deleteGraphRecord?: (input: { kind: 'node' | 'edge'; id: string }) => Promise<void>
  /** Read-only GraphRAG for recall_relations */
  graphReader?: import('@baishou/shared').ToolGraphReader
  /** Exact name / id lookup for graph_upsert */
  graphNodeLookup?: import('@baishou/shared').ToolGraphNodeLookup
  /** Existing-edge lookup for graph_upsert updates */
  graphEdgeLookup?: import('@baishou/shared').ToolGraphEdgeLookup
  /** Read-only knowledge notebook graph for knowledge_graph_search */
  knowledgeGraphReader?: import('@baishou/shared').ToolKnowledgeGraphReader
  /** Read-only knowledge notebook search for knowledge_search */
  knowledgeReader?: import('@baishou/shared').ToolKnowledgeReader
  /**
   * 解析 vaultId → 显示名（供 prompt / Gate）。
   * 宿主有 registry 时应注入；缺省时退回 vaultId 或 'Personal'。
   */
  resolveVaultDisplayName?: (vaultId: string) => string | null | undefined
  /** Workspace session context for folder-bound agent tools */
  workspace?: {
    folderRoot: string
    sessionKind?: AgentSessionKind
    /** 会话挂载的知识库笔记本（最多 3 本） */
    notebookIds?: string[]
    /** 工作区身份，供 Gate scope / 观测 */
    workspaceId?: string
    /** 注入 system <workspace_env> 的元数据 */
    env?: {
      platform?: string
      isGitRepo?: boolean
      gitBranch?: string | null
      gitChangesCount?: number | null
    }
    fs?: WorkspaceFsAdapter
    roundCheckpointService?: AgentRoundCheckpointService
    roundCheckpointId?: string
    onFileChange?: (change: FileChangePartData) => void
  }
  /** Skills 目录（名+描述），注入 system <skills_catalog> */
  skillsCatalog?: Array<{ name: string; description?: string }>
  skillsWriter?: import('../tools/agent.tool').ToolContext['skillsWriter']
  /** 额外 Vercel 工具（如外部 /mcp 客户端），在内置工具之后合并 */
  extraVercelToolsFactory?: (
    context: import('../tools/agent.tool').ToolContext
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  /** 覆盖默认 maxSteps（SDK 内或多 turn 外环）；未传时由 resolveSessionRuntimeProfile 从 userConfig 解析 */
  maxSteps?: number
  /** 覆盖 Session Runtime v2；未传时按 sessionKind + userConfig 解析（workspace 默认开） */
  sessionRuntimeV2?: boolean
}

export interface StreamChatCallbacks {
  onTextDelta?: (text: string) => void
  onReasoningDelta?: (text: string) => void
  onToolCallStart?: (toolName: string, args: unknown, toolCallId?: string) => void
  onToolCallResult?: (toolName: string, result: unknown, toolCallId?: string) => void
  onError?: (error: Error) => void
  onFinish?: (result?: {
    messageId?: string
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
    costMicros?: number
  }) => void
}
