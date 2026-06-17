/** 归档全量导入期间为 true，用于跳过峰值内存敏感步骤（如 Agent FTS 全量回填） */
let archiveImportDepth = 0

export function enterAgentMigrationArchiveImport(): void {
  archiveImportDepth += 1
}

export function exitAgentMigrationArchiveImport(): void {
  archiveImportDepth = Math.max(0, archiveImportDepth - 1)
}

export function isAgentMigrationArchiveImport(): boolean {
  return archiveImportDepth > 0
}
