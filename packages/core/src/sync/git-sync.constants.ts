import type { GitSyncConfig } from '@baishou/shared'

/** 内置 Git 无全局配置时的默认提交签名（用户可在设置中覆盖） */
export const DEFAULT_GIT_AUTHOR_NAME = 'BaiShou'
export const DEFAULT_GIT_AUTHOR_EMAIL = 'baishou@local'

export const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  enabled: false,
  userName: DEFAULT_GIT_AUTHOR_NAME,
  userEmail: DEFAULT_GIT_AUTHOR_EMAIL
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

# 增量同步冲突备份（*.conflict-<timestamp>.*）
**/*.conflict-*

# 本地快照与临时文件
snapshots/
temp/
.snapshots/
*.tmp
.write_test
.write_test_*
.baishou_write_test
.DS_Store
Thumbs.db
`

export const GIT_SYNC_CONFIG_FILE = '.baishou-git.json'

/** getStatus / stage 时索引维护的最大轮次，防止 repair/sanitize 死循环 */
export const GIT_INDEX_MAINTENANCE_MAX_ROUNDS = 5

/** spawn git 子进程超时（毫秒） */
export const GIT_RAW_COMMAND_TIMEOUT_MS = 30_000

/** 超过该数量时用 git add . 批量暂存 */
export const STAGE_FAST_ADD_THRESHOLD = 40

/** 分块 git add 时每块最大文件数 */
export const STAGE_ADD_CHUNK_SIZE = 50

/** 分块 git add 时 argv 字符上限（兼容 Windows） */
export const STAGE_MAX_ARG_CHARS = 7000
