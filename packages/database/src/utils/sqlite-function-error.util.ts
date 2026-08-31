/** SQLite 扩展/自定义函数未安装时的典型错误文案 */
export function isMissingSqliteFunctionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('no such function') ||
    lower.includes('unknown function') ||
    lower.includes('not authorized to use function')
  )
}

export function isSqliteUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error
  for (let i = 0; i < 6 && current; i++) {
    const message = current instanceof Error ? current.message : String(current)
    const code =
      typeof current === 'object' && current && 'code' in current
        ? String((current as { code?: unknown }).code)
        : ''
    if (
      /UNIQUE constraint failed/i.test(message) ||
      /SQLITE_CONSTRAINT/i.test(code) ||
      /SQLITE_CONSTRAINT_UNIQUE/i.test(message) ||
      message.includes('graph_nodes_vault_type_name_live') ||
      message.includes('idx_nb_graph_nodes_live_name')
    ) {
      return true
    }
    current =
      current instanceof Error ? (current as Error & { cause?: unknown }).cause : undefined
  }
  return false
}
