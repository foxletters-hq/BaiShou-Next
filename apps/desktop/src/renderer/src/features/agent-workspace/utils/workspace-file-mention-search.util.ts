const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.svn',
  '.hg',
  '.next',
  'coverage'
])

export function rankFileMentionCandidates(params: {
  query: string
  recentPaths: string[]
  searchedPaths: string[]
  limit?: number
}): Array<{ path: string; group: 'recent' | 'search' }> {
  const limit = params.limit ?? 20
  const query = params.query.trim().toLowerCase().replace(/\\/g, '/')
  const seen = new Set<string>()
  const result: Array<{ path: string; group: 'recent' | 'search' }> = []

  const matches = (path: string) => {
    if (!query) return true
    return path.toLowerCase().replace(/\\/g, '/').includes(query)
  }

  for (const path of params.recentPaths) {
    const normalized = path.replace(/\\/g, '/')
    if (!normalized || seen.has(normalized) || !matches(normalized)) continue
    seen.add(normalized)
    result.push({ path: normalized, group: 'recent' })
    if (result.length >= limit) return result
  }

  for (const path of params.searchedPaths) {
    const normalized = path.replace(/\\/g, '/')
    if (!normalized || seen.has(normalized) || !matches(normalized)) continue
    seen.add(normalized)
    result.push({ path: normalized, group: 'search' })
    if (result.length >= limit) return result
  }

  return result
}

export async function searchWorkspaceFileNames(params: {
  folderRoot: string
  query: string
  listDir: (
    rootPath: string,
    relativePath?: string
  ) => Promise<Array<{ relativePath: string; name: string; isDirectory: boolean }>>
  limit?: number
}): Promise<string[]> {
  const limit = params.limit ?? 40
  const query = params.query.trim().toLowerCase().replace(/\\/g, '/')
  if (!query) return []
  const matches: string[] = []
  const queue: string[] = ['']

  while (queue.length > 0 && matches.length < limit) {
    const parent = queue.shift() ?? ''
    let entries: Array<{ relativePath: string; name: string; isDirectory: boolean }>
    try {
      entries = await params.listDir(params.folderRoot, parent || undefined)
    } catch {
      continue
    }
    for (const entry of entries) {
      const name = entry.name.toLowerCase()
      if (entry.isDirectory) {
        if (SKIP_DIR_NAMES.has(entry.name) || name.startsWith('.')) continue
        queue.push(entry.relativePath)
        continue
      }
      const rel = entry.relativePath.replace(/\\/g, '/')
      if (!query || rel.toLowerCase().includes(query) || name.includes(query)) {
        matches.push(rel)
        if (matches.length >= limit) break
      }
    }
  }

  return matches
}
