/** SQLite 扩展/自定义函数未安装时的典型错误文案 */
export function isMissingSqliteFunctionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('no such function') ||
    lower.includes('unknown function') ||
    lower.includes('not authorized to use function')
  )
}
