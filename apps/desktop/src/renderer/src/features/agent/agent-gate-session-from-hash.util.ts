/** HashRouter 下从 location.hash 取出当前会话 id；工作台目录段不是会话 */
const WORKBENCH_NON_SESSION_SEGMENTS = new Set([
  'knowledge',
  'skills',
  'templates',
  'projects',
  'open'
])

export function sessionIdFromDesktopLocationHash(hash: string): string | null {
  const path = hash.replace(/^#/, '')
  const chatMatch = path.match(/^\/chat\/([^/?#]+)/)
  if (chatMatch?.[1]) return decodeURIComponent(chatMatch[1])
  const wsMatch = path.match(/^\/agent-workspace\/([^/?#]+)/)
  if (!wsMatch?.[1]) return null
  const segment = decodeURIComponent(wsMatch[1])
  if (WORKBENCH_NON_SESSION_SEGMENTS.has(segment)) return null
  return segment
}
