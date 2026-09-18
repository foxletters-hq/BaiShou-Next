/** 模型只出了工具调用、没有正文时，SDK 会抛这个错误，不应中断续跑 */
export function isNoOutputGeneratedError(error: unknown): boolean {
  if (error == null) return false
  if (typeof error === 'object') {
    const record = error as { [key: symbol]: unknown; name?: unknown; message?: unknown }
    if (record[Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')] === true) return true
    const name = typeof record.name === 'string' ? record.name : ''
    const message = typeof record.message === 'string' ? record.message : ''
    if (name === 'AI_NoOutputGeneratedError' || message.includes('NoOutputGenerated')) return true
  }
  return typeof error === 'string' && error.includes('NoOutputGenerated')
}
