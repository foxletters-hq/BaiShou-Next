import type { GitSyncConfig } from '@baishou/shared'

export const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  enabled: false
}

/** 存储根 `.gitignore`：覆盖全部工作区（Vault） */
export const GITIGNORE_CONTENT = `# 增量同步配置与元数据（存储根）
.baishou/
.baishou-s3.json
.baishou-git.json

# 工作区嵌套 Git 归档（修复子模块/gitlink 时产生，勿入库）
**/.git.vault-legacy/

# SQLite 数据库（任意位置）
*.db
*.db-journal
*.db-wal
*.db-shm

# 各工作区内的应用数据目录（settings 等由增量同步管理）
**/.baishou/

# 冲突备份目录
**/.versions/

# 本地快照与临时文件
snapshots/
temp/
.snapshots/
*.tmp
.DS_Store
Thumbs.db
`

export const GIT_SYNC_CONFIG_FILE = '.baishou-git.json'

/** getStatus / stage 时索引维护的最大轮次，防止 repair/sanitize 死循环 */
export const GIT_INDEX_MAINTENANCE_MAX_ROUNDS = 5

/** spawn git 子进程超时（毫秒） */
export const GIT_RAW_COMMAND_TIMEOUT_MS = 30_000
