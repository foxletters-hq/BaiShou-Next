/** 将同步相对路径分类，供 post-sync 按需索引（桌面/移动共用） */
export function classifyIncrementalSyncPaths(paths: readonly string[]): {
  journals: boolean
  sessions: boolean
  summaries: boolean
  settings: boolean
  assistants: boolean
  /** Memory/ JSONL shards — pending-index → memory_embeddings */
  memory: boolean
  /** Graph/ nodes|edges JSONL — pending-index → graph_* tables */
  graph: boolean
  sessionRefs: Array<{ vaultName: string; sessionId: string }>
} {
  let journals = false
  let sessions = false
  let summaries = false
  let settings = false
  let assistants = false
  let memory = false
  let graph = false
  const sessionRefs: Array<{ vaultName: string; sessionId: string }> = []
  const seenSession = new Set<string>()

  for (const raw of paths) {
    const p = raw.replace(/\\/g, '/')
    if (/(^|\/)Journals\//.test(p) || /(^|\/)Diary\//.test(p)) journals = true
    if (/(^|\/)Summaries\//.test(p) || /(^|\/)Archives\//.test(p)) summaries = true
    if (p.includes('.baishou/settings') || /(^|\/)settings\//.test(p)) settings = true
    if (/(^|\/)Assistants\//.test(p)) assistants = true
    if (/(^|\/)Memory\//.test(p)) memory = true
    if (/(^|\/)Graph\//.test(p)) graph = true

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

  return { journals, sessions, summaries, settings, assistants, memory, graph, sessionRefs }
}
