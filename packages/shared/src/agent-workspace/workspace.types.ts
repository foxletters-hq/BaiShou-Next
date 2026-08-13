import { z } from 'zod'
import type {
  AgentDialogueSelectionState,
  AgentDialogueSelectionSwitchEvent,
  DialogueModelSelectionSource
} from '../utils/agent-dialogue-model.util'

export type {
  AgentDialogueSelectionState,
  AgentDialogueSelectionSwitchEvent,
  DialogueModelSelectionSource
}

export const AgentSessionKindSchema = z.enum(['companion', 'workspace'])

export type AgentSessionKind = z.infer<typeof AgentSessionKindSchema>

export const WorkspaceSnapshotStrategySchema = z.enum(['turn'])

export type WorkspaceSnapshotStrategy = z.infer<typeof WorkspaceSnapshotStrategySchema>

export const WorkspaceSessionMetadataSchema = z.object({
  folderRoot: z.string().min(1),
  folderDisplayName: z.string().optional(),
  snapshotStrategy: WorkspaceSnapshotStrategySchema.default('turn')
})

export type WorkspaceSessionMetadata = z.infer<typeof WorkspaceSessionMetadataSchema>

export interface AgentSessionMetadata {
  sessionKind?: AgentSessionKind
  workspace?: WorkspaceSessionMetadata
  /** 当前伙伴与模型选择及来源（工作区/Agent 会话 UI 与流式发送对齐） */
  selection?: AgentDialogueSelectionState
  /** 最近一次助手/模型切换记录（轻量，可选） */
  lastSelectionSwitch?: AgentDialogueSelectionSwitchEvent
}

export interface AgentWorkspaceDirEntry {
  name: string
  relativePath: string
  isDirectory: boolean
}

export interface AgentWorkspaceReadFileResult {
  content: string
  truncated: boolean
  byteLength: number
}

/** 侧栏变更列表项（由 file_change part 聚合） */
export interface WorkspaceChangeListItem {
  id: string
  path: string
  kind: import('./file-change.types').FileChangeKind
  additions: number
  deletions: number
}

/** 含完整 diff 数据的变更项（右侧面板展示） */
export interface WorkspaceChangeEntry extends WorkspaceChangeListItem {
  data: import('./file-change.types').FileChangePartData
}

/** 工作区侧栏会话列表项 */
export interface AgentWorkspaceSessionListItem {
  sessionId: string
  title: string
  folderRoot: string
  folderDisplayName: string
  updatedAt: string
}

/** 工作区类型：普通文件夹 / 内置临时「稿纸」 */
export type AgentWorkspaceKind = 'folder' | 'scratch'

/** Agent 页左侧工作区条目（本地文件夹 + 可自定义方形图标） */
export interface AgentWorkspaceEntry {
  id: string
  folderRoot: string
  displayName: string
  avatarPath?: string | null
  /** 缺省视为 folder；scratch 为内置临时「稿纸」工作区 */
  kind?: AgentWorkspaceKind
  /** 置顶时间；有值表示侧栏「最近项目」置顶 */
  pinnedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentWorkspaceEntryUpdate {
  displayName?: string
  avatarPath?: string | null
  kind?: AgentWorkspaceKind
  /** 传 null 取消置顶 */
  pinnedAt?: string | null
}
