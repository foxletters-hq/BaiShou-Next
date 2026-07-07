import { formatLocalDate } from './date.utils'

/** Git 提交留空时使用的默认说明：本地日期 + 时间（含秒） */
export function formatDefaultGitCommitMessage(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${formatLocalDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 提交消息为空或仅空白时，回退为当前本地日期时间 */
export function resolveGitCommitMessage(message: string, date = new Date()): string {
  const trimmed = message.trim()
  return trimmed || formatDefaultGitCommitMessage(date)
}
