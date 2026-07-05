/** 与日记同级的总结目录名（外部 Obsidian 布局：2.日记/Archives） */
export const JOURNAL_TREE_SKIP_DIR_NAMES = new Set(['Archives'])

/** 路径是否位于日记树中应跳过的子目录（扫描、监听、统计共用） */
export function isJournalPathUnderSkippedDir(filePath: string): boolean {
  const parts = filePath.split(/[/\\]/)
  return parts.some((segment) => JOURNAL_TREE_SKIP_DIR_NAMES.has(segment))
}

/** 生成 SQLite file_path 列排除跳过目录的 LIKE 条件片段（不含 WHERE） */
export function buildJournalTreeSkipSqlLikeClauses(columnName = 'file_path'): string[] {
  const clauses: string[] = []
  for (const dir of JOURNAL_TREE_SKIP_DIR_NAMES) {
    clauses.push(`${columnName} NOT LIKE '%/${dir}/%'`)
    clauses.push(`${columnName} NOT LIKE '%\\\\${dir}\\\\%'`)
    clauses.push(`${columnName} NOT LIKE '${dir}/%'`)
    clauses.push(`${columnName} NOT LIKE '${dir}\\\\%'`)
  }
  return clauses
}
