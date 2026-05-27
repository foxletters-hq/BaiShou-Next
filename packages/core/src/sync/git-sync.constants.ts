import type { GitSyncConfig } from '@baishou/shared'

export const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  enabled: false
}

export const GITIGNORE_CONTENT = `# SQLite 数据库
*.db
*.db-journal
*.db-wal
*.db-shm

# 应用数据目录（由 BaiShou 管理，不作为日记内容版本化）
.baishou/

# 版本备份（由 Git 本身管理历史）
.versions/

# 临时文件
*.tmp
.DS_Store
Thumbs.db
`

export const GIT_SYNC_CONFIG_FILE = '.baishou-git.json'
