/** 将同步相对路径分类，供 post-sync 按需索引（桌面/移动共用） */
export function classifyIncrementalSyncPaths(paths: readonly string[]): {
  journals: boolean
  sessions: boolean
  summaries: boolean
  settings: boolean
  assistants: boolean
  sessionRefs: Array<{ vaultName: string; sessionId: string }>
} {
  let journals = false
  let sessions = false
  let summaries = false
  let settings = false
  let assistants = false
  const sessionRefs: Array<{ vaultName: string; sessionId: string }> = []
  const seenSession = new Set<string>()

  for (const raw of paths) {
    const p = raw.replace(/\\/g, '/')
    if (/(^|\/)Journals\//.test(p) || /(^|\/)Diary\//.test(p)) journals = true
    if (/(^|\/)Summaries\//.test(p) || /(^|\/)Archives\//.test(p)) summaries = true
    if (p.includes('.baishou/settings') || /(^|\/)settings\//.test(p)) settings = true
    if (/(^|\/)Assistants\//.test(p)) assistants = true

    const sessionMatch = p.match(/(?:^|\/)([^/]+)\/Sessions\/([^/]+)\.json$/i)
    const vaultName = sessionMatch?.[1]
    const sessionId = sessionMatch?.[2]
    if (vaultName && sessionId) {
      sessions = true
      const key = `${vaultName}/${sessionId}`
      if (!seenSession.has(key)) {
        seenSession.add(key)
        sessionRefs.push({ vaultName, sessionId })
      }
    }
  }

  return { journals, sessions, summaries, settings, assistants, sessionRefs }
}
