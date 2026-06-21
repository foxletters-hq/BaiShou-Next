import type {
  GitSyncConfig,
  GitCommit,
  GitStatus,
  VersionHistoryEntry,
  FileChange,
  FileDiff,
  GitRollbackAllContext
} from '@baishou/shared'

export interface GitManagementPageProps {
  // 配置
  config: GitSyncConfig
  onSaveConfig: (config: Partial<GitSyncConfig>) => void
  // 初始化
  onInit: () => Promise<{ success: boolean; message?: string }>
  isInitialized: boolean
  // 远程
  onTestRemote: () => Promise<boolean>
  /** 仅提交已暂存文件 */
  onCommit: (message: string) => Promise<GitCommit | null>
  /** 无暂存时自动 stage 全部后提交；有暂存时 UI 优先走 onCommit */
  onCommitAll: (message: string) => Promise<GitCommit | null>
  // 提示
  onToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  // 状态
  onGetStatus: () => Promise<GitStatus>
  // 历史
  onGetHistory: (
    filePath?: string,
    limit?: number,
    offset?: number
  ) => Promise<VersionHistoryEntry[]>
  onGetRecentPulls: (limit?: number) => Promise<VersionHistoryEntry[]>
  onGetCommitChanges: (commitHash: string) => Promise<FileChange[]>
  onGetFileDiff: (filePath: string, commitHash?: string) => Promise<FileDiff>
  onGetWorkingDiff: (filePath: string, staged: boolean) => Promise<FileDiff>
  // 暂存操作
  onStageFile: (filePath: string) => Promise<void>
  onStageAll: () => Promise<void>
  onUnstageFile: (filePath: string) => Promise<void>
  onUnstageAll: () => Promise<void>
  onDiscardFile: (filePath: string) => Promise<void>
  onDiscardAllChanges: () => Promise<void>
  // 同步
  onPush: () => Promise<{ success: boolean; message?: string }>
  onPull: () => Promise<{
    success: boolean
    message?: string
    conflicts?: string[]
  }>
  onHasConflicts: () => Promise<boolean>
  onGetConflicts: () => Promise<string[]>
  onResolveConflict: (
    filePath: string,
    resolution: 'ours' | 'theirs'
  ) => Promise<{ success: boolean }>
  // 回滚
  onRollbackFile: (filePath: string, commitHash: string) => Promise<{ success: boolean }>
  onRollbackAll: (commitHash: string) => Promise<{ success: boolean }>
  onGetRollbackAllContext: (commitHash: string) => Promise<GitRollbackAllContext>
}
