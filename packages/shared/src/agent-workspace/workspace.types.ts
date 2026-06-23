import { z } from 'zod'

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
