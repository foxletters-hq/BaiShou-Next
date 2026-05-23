// ── Git 版本控制类型 ─────────────────────────────────────────

/** Git 提交记录 */
export interface GitCommit {
  /** commit hash（短格式，7 位） */
  hash: string;
  /** 提交消息 */
  message: string;
  /** 提交时间 */
  date: Date;
  /** 变更的文件列表 */
  files: string[];
}

/** 文件变更状态 */
export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/** 文件变更详情 */
export interface FileChange {
  /** 文件相对路径 */
  path: string;
  /** 变更状态 */
  status: FileChangeStatus;
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
}

/** diff 块 */
export interface DiffHunk {
  /** 旧文件起始行 */
  oldStart: number;
  /** 旧文件行数 */
  oldLines: number;
  /** 新文件起始行 */
  newStart: number;
  /** 新文件行数 */
  newLines: number;
  /** diff 内容 */
  content: string;
}

/** 单个文件的 diff */
export interface FileDiff {
  /** 文件路径 */
  path: string;
  /** diff 块列表 */
  hunks: DiffHunk[];
}

/** Git 远程仓库配置 */
export interface GitRemoteConfig {
  /** 远程仓库地址 */
  url: string;
  /** 分支名 */
  branch: string;
  /** 用户名 */
  username?: string;
  /** 密码或个人访问令牌 */
  token?: string;
}

/** Git 同步配置 */
export interface GitSyncConfig {
  /** 是否启用 Git 版本管理 */
  enabled: boolean;
  /** 提交用户名 */
  userName?: string;
  /** 提交邮箱 */
  userEmail?: string;
  /** 远程仓库配置（可选） */
  remote?: GitRemoteConfig;
}

// ── S3 增量同步类型 ──────────────────────────────────────────

/** S3 增量同步配置 */
export interface S3SyncConfig {
  /** 是否启用同步 */
  enabled: boolean;
  /** 目标类型：s3 或 webdav */
  target?: 's3' | 'webdav';
  /** S3 端点 */
  endpoint: string;
  /** S3 区域 */
  region: string;
  /** S3 桶名 */
  bucket: string;
  /** 桶内路径前缀 */
  path: string;
  /** 访问密钥 ID / WebDAV 用户名 */
  accessKey: string;
  /** 秘密访问密钥 / WebDAV 密码 */
  secretKey: string;
  /** WebDAV URL（仅 target=webdav 时使用） */
  webdavUrl?: string;
  /** 大文件切片分块上传的并发度，默认 5 */
  chunkConcurrency?: number;
  /** 文件级别并发上传下载度，默认 5 */
  fileConcurrency?: number;
}

/** 文件清单条目 */
export interface ManifestEntry {
  /** 文件内容 MD5 */
  hash: string;
  /** 文件大小（字节） */
  size: number;
  /** 最后修改时间戳（毫秒） */
  lastModified: number;
}

/**
 * 文件清单 V2
 * 纯状态快照：只记录当前存在的文件，不记录历史。
 * 文件删除后条目直接移除，体积随文件数线性增长，不随时间膨胀。
 */
export interface SyncManifest {
  /** 清单版本号 = 2 */
  version: number;
  /** 最后更新时间戳（毫秒） */
  updatedAt: number;
  /** 最后更新的设备 ID */
  deviceId: string;
  /** 文件清单（key 为 vault 内相对路径） */
  files: Record<string, ManifestEntry>;
}

/** 同步操作类型 */
export type SyncOperationType =
  | 'upload'
  | 'download'
  | 'delete-remote'
  | 'delete-local'
  | 'conflict-resolved';

/** 单条操作记录 */
export interface SyncOperationEntry {
  /** 操作 ID (UUID v4) */
  id: string;
  /** 操作类型 */
  type: SyncOperationType;
  /** 文件相对路径（相对于 vault 根） */
  filePath: string;
  /** 操作前 hash（用于追溯） */
  hashBefore: string | null;
  /** 操作后 hash */
  hashAfter: string | null;
  /** 文件大小（字节） */
  size: number;
  /** 操作时间 (ISO 8601) */
  timestamp: string;
  /** 冲突时被备份的版本路径 */
  backupPath?: string;
}

/** 同步方向 */
export type SyncDirection = 'full-sync' | 'upload-only' | 'download-only';

/** 同步摘要 */
export interface SyncSummary {
  uploaded: number;
  downloaded: number;
  deletedRemote: number;
  deletedLocal: number;
  conflicts: number;
  skipped: number;
}

/** 一次同步会话的记录 */
export interface SyncSessionLog {
  /** 会话 ID */
  sessionId: string;
  /** 设备 ID */
  deviceId: string;
  /** 同步方向 */
  direction: SyncDirection;
  /** 开始时间 (ISO 8601) */
  startedAt: string;
  /** 结束时间 (ISO 8601) */
  completedAt: string;
  /** 是否成功 */
  success: boolean;
  /** 操作条目列表 */
  operations: SyncOperationEntry[];
  /** 文件计数摘要 */
  summary: SyncSummary;
  /** 错误信息（仅在失败时有值） */
  error?: string;
}

/** 增量同步结果 V2 */
export interface IncrementalSyncResult {
  /** 上传的文件列表 */
  uploaded: string[];
  /** 下载的文件列表 */
  downloaded: string[];
  /** 冲突的文件列表（mtime 决策已自动处理） */
  conflicted: string[];
  /** 跳过的文件列表（无变更） */
  skipped: string[];
  /** 删除的远程文件列表 */
  deletedRemote: string[];
  /** 删除的本地文件列表 */
  deletedLocal: string[];
  /** 同步耗时（毫秒） */
  duration: number;
  /** 本次同步会话 ID */
  sessionId: string;
}

// ── 版本管理类型 ─────────────────────────────────────────────

/** 版本快照 */
export interface VersionSnapshot {
  /** 版本 ID（时间戳） */
  id: number;
  /** 文件相对路径 */
  filePath: string;
  /** 文件大小（字节） */
  size: number;
  /** 创建时间 */
  createdAt: Date;
  /** 备份原因 */
  reason: 'sync' | 'edit' | 'conflict';
}

/** 版本历史条目（UI 展示用） */
export interface VersionHistoryEntry {
  /** 提交记录 */
  commit: GitCommit;
  /** 文件变更列表 */
  changes: FileChange[];
  /** 是否为当前版本 */
  isCurrent: boolean;
}

// ── 同步进度类型 ──────────────────────────────────────────────

/** 同步进度事件 */
export interface SyncProgressEvent {
  /** 当前阶段 */
  phase: 'scanning' | 'comparing' | 'syncing' | 'finalizing';
  /** 当前已处理文件数 */
  current: number;
  /** 总文件数 */
  total: number;
  /** 当前操作的文件相对路径 */
  fileName?: string;
  /** 操作类型 */
  action?: 'upload' | 'download' | 'delete' | 'skip';
  /** 状态描述文本 */
  statusText?: string;
}

/** 同步进度回调 */
export type SyncProgressCallback = (event: SyncProgressEvent) => void;

// ── Git 状态类型 ──────────────────────────────────────────────

/** Git 工作区文件状态 */
export interface GitStatusFile {
  /** 文件相对路径 */
  path: string;
  /** 暂存区状态（空字符串表示未暂存） */
  stagedStatus: FileChangeStatus | '';
  /** 工作区状态（空字符串表示未修改） */
  unstagedStatus: FileChangeStatus | '';
}

/** Git 工作区状态 */
export interface GitStatus {
  /** 已暂存的文件变更 */
  staged: GitStatusFile[];
  /** 未暂存的文件变更 */
  unstaged: GitStatusFile[];
  /** 未跟踪的文件 */
  untracked: string[];
  /** 冲突文件 */
  conflicted: string[];
  /** 是否有任何变更 */
  hasChanges: boolean;
}
