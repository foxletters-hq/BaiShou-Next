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
}

/** Git 同步配置 */
export interface GitSyncConfig {
  /** 是否启用 Git 版本管理 */
  enabled: boolean;
  /** 同步前是否自动 commit */
  autoCommit: boolean;
  /** commit 消息模板，支持 {date} 占位符 */
  commitMessageTemplate: string;
  /** 远程仓库配置（可选） */
  remote?: GitRemoteConfig;
}

// ── S3 增量同步类型 ──────────────────────────────────────────

/** S3 增量同步配置 */
export interface S3SyncConfig {
  /** 是否启用 S3 同步 */
  enabled: boolean;
  /** S3 端点 */
  endpoint: string;
  /** S3 区域 */
  region: string;
  /** S3 桶名 */
  bucket: string;
  /** 桶内路径前缀 */
  path: string;
  /** 访问密钥 ID */
  accessKey: string;
  /** 秘密访问密钥 */
  secretKey: string;
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

/** 文件清单 */
export interface SyncManifest {
  /** 清单版本号 */
  version: number;
  /** 最后更新时间戳（毫秒） */
  updatedAt: number;
  /** 最后更新的设备 ID */
  deviceId: string;
  /** 文件清单（key 为相对路径） */
  files: Record<string, ManifestEntry>;
}

/** 增量同步结果 */
export interface IncrementalSyncResult {
  /** 上传的文件列表 */
  uploaded: string[];
  /** 下载的文件列表 */
  downloaded: string[];
  /** 冲突的文件列表（Last-Write-Wins 已自动处理） */
  conflicted: string[];
  /** 跳过的文件列表（无变更） */
  skipped: string[];
  /** 同步耗时（毫秒） */
  duration: number;
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
