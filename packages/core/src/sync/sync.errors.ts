// ── Git 错误 ─────────────────────────────────────────────────

/** Git 仓库初始化失败 */
export class GitInitError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to initialize Git repository');
    this.name = 'GitInitError';
  }
}

/** Git 提交失败 */
export class GitCommitError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to commit changes');
    this.name = 'GitCommitError';
  }
}

/** Git 推送到远程仓库失败 */
export class GitPushError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to push to remote repository');
    this.name = 'GitPushError';
  }
}

/** Git 拉取失败 */
export class GitPullError extends Error {
  /** 冲突的文件列表（仅在冲突时存在） */
  constructor(public readonly conflicts?: string[], public readonly cause?: Error) {
    super('Failed to pull from remote' + (conflicts ? ', conflicts detected' : ''));
    this.name = 'GitPullError';
  }
}

/** 未配置 Git 远程仓库 */
export class GitRemoteNotConfiguredError extends Error {
  constructor() {
    super('Git remote is not configured');
    this.name = 'GitRemoteNotConfiguredError';
  }
}

/** Git 回滚失败 */
export class GitRollbackError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to rollback');
    this.name = 'GitRollbackError';
  }
}

/** Git 配置错误 */
export class GitConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitConfigError';
  }
}

/** Git 仓库未初始化 */
export class GitNotInitializedError extends Error {
  constructor() {
    super('Git repository is not initialized');
    this.name = 'GitNotInitializedError';
  }
}

// ── S3 错误 ──────────────────────────────────────────────────

/** 未配置 S3 同步 */
export class S3NotConfiguredError extends Error {
  constructor() {
    super('S3 sync is not configured');
    this.name = 'S3NotConfiguredError';
  }
}

/** S3 连接失败 */
export class S3ConnectionError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to connect to S3');
    this.name = 'S3ConnectionError';
  }
}

/** S3 同步失败 */
export class S3SyncError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'S3SyncError';
  }
}

/** S3 配置错误 */
export class S3ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'S3ConfigError';
  }
}

/** 文件清单获取失败 */
export class ManifestFetchError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to fetch sync manifest');
    this.name = 'ManifestFetchError';
  }
}

// ── 版本管理错误 ─────────────────────────────────────────────

/** 版本备份失败 */
export class VersionBackupError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to backup file version');
    this.name = 'VersionBackupError';
  }
}

/** 版本恢复失败 */
export class VersionRestoreError extends Error {
  constructor(public readonly cause?: Error) {
    super('Failed to restore file version');
    this.name = 'VersionRestoreError';
  }
}

/** 版本不存在 */
export class VersionNotFoundError extends Error {
  constructor(versionId: number) {
    super(`Version ${versionId} not found`);
    this.name = 'VersionNotFoundError';
  }
}
