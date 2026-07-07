import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  WorkspaceReplaceOptions,
  WorkspaceReplaceResult,
  WorkspaceSearchFileResult,
  WorkspaceSearchMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResult
} from '@baishou/shared'

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

const DEFAULT_EXCLUDE =
  'node_modules, .git, dist, out, build, .next, coverage, **/*.code-search'

const MAX_FILE_BYTES = 512 * 1024
const DEFAULT_MAX_MATCHES = 2000
const DEFAULT_MAX_FILES = 200

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.json',
  '.jsonc',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.svg',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.bat',
  '.cmd',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.sql',
  '.graphql',
  '.vue',
  '.svelte',
  '.lock'
])

function resolveWithinRoot(rootPath: string, relativePath = ''): string {
  const root = path.resolve(rootPath)
  const target = path.resolve(root, relativePath || '.')
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace root')
  }
  return target
}

function splitPatterns(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/').trim()
  let regex = '^'
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        regex += '.*'
        i += 1
      } else {
        regex += '[^/]*'
      }
    } else if (ch === '?') {
      regex += '[^/]'
    } else {
      regex += escapeRegex(ch)
    }
  }
  regex += '$'
  return new RegExp(regex, 'i')
}

function matchesGlob(relativePath: string, pattern: string): boolean {
  const posix = relativePath.replace(/\\/g, '/')
  const normalizedPattern = pattern.replace(/\\/g, '/').trim()
  if (!normalizedPattern) return false
  if (normalizedPattern.includes('/')) {
    return globToRegExp(normalizedPattern).test(posix)
  }
  const base = posix.split('/').pop() ?? posix
  return (
    globToRegExp(normalizedPattern).test(base) ||
    globToRegExp(`**/${normalizedPattern}`).test(posix)
  )
}

function matchesAnyGlob(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(relativePath, pattern))
}

function shouldSearchFile(relativePath: string, options: WorkspaceSearchOptions): boolean {
  const include = splitPatterns(options.includePattern)
  const exclude = [...splitPatterns(DEFAULT_EXCLUDE), ...splitPatterns(options.excludePattern)]

  if (exclude.length > 0 && matchesAnyGlob(relativePath, exclude)) {
    return false
  }
  if (include.length > 0) {
    return matchesAnyGlob(relativePath, include)
  }

  const ext = path.posix.extname(relativePath.replace(/\\/g, '/')).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  return !ext
}

function buildSearchRegex(options: WorkspaceSearchOptions): RegExp | null {
  const pattern = options.pattern
  if (!pattern) return null

  let source = pattern
  if (!options.useRegex) {
    source = escapeRegex(pattern)
    if (options.matchWholeWord) {
      source = `\\b${source}\\b`
    }
  }

  try {
    return new RegExp(source, options.matchCase ? 'g' : 'gi')
  } catch {
    return null
  }
}

function isProbablyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096))
  if (sample.includes(0)) return false
  return true
}

async function collectSearchableFiles(
  rootPath: string,
  relativePath = '',
  options: WorkspaceSearchOptions,
  acc: string[] = []
): Promise<string[]> {
  const dirPath = resolveWithinRoot(rootPath, relativePath)
  let entries: string[]
  try {
    entries = await fs.readdir(dirPath)
  } catch {
    return acc
  }

  for (const name of entries) {
    if (name.startsWith('.')) continue
    const entryRelative = relativePath
      ? path.posix.join(relativePath.replace(/\\/g, '/'), name)
      : name
    const fullPath = path.join(dirPath, name)

    let stat
    try {
      stat = await fs.stat(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue
      await collectSearchableFiles(rootPath, entryRelative, options, acc)
      continue
    }

    if (!stat.isFile()) continue
    if (stat.size > MAX_FILE_BYTES) continue
    if (!shouldSearchFile(entryRelative, options)) continue
    acc.push(entryRelative)
  }

  return acc
}

function findMatchesInContent(content: string, regex: RegExp): WorkspaceSearchMatch[] {
  const matches: WorkspaceSearchMatch[] = []
  const lines = content.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index]
    const lineRegex = new RegExp(regex.source, regex.flags)
    let match: RegExpExecArray | null
    while ((match = lineRegex.exec(lineText)) !== null) {
      matches.push({
        line: index + 1,
        lineText,
        matchStart: match.index,
        matchEnd: match.index + match[0].length
      })
      if (match[0].length === 0) {
        lineRegex.lastIndex += 1
      }
    }
  }

  return matches
}

function replaceInContent(content: string, regex: RegExp, replacement: string): {
  next: string
  count: number
} {
  let count = 0
  const next = content.replace(regex, () => {
    count += 1
    return replacement
  })
  return { next, count }
}

export async function searchWorkspaceFiles(
  rootPath: string,
  options: WorkspaceSearchOptions
): Promise<WorkspaceSearchResult> {
  const pattern = options.pattern.trim()
  if (!pattern) {
    return { files: [], totalMatches: 0, totalFiles: 0, truncated: false }
  }

  const regex = buildSearchRegex(options)
  if (!regex) {
    return {
      files: [],
      totalMatches: 0,
      totalFiles: 0,
      truncated: false,
      invalidPattern: true
    }
  }

  const maxMatches = options.maxMatches ?? DEFAULT_MAX_MATCHES
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const filePaths = await collectSearchableFiles(rootPath, '', options)
  const files: WorkspaceSearchFileResult[] = []
  let totalMatches = 0
  let truncated = false

  for (const relativePath of filePaths) {
    if (files.length >= maxFiles || totalMatches >= maxMatches) {
      truncated = true
      break
    }

    const filePath = resolveWithinRoot(rootPath, relativePath)
    let buffer: Buffer
    try {
      buffer = await fs.readFile(filePath)
    } catch {
      continue
    }
    if (!isProbablyText(buffer)) continue

    const content = buffer.toString('utf-8')
    const fileMatches = findMatchesInContent(content, regex)
    if (fileMatches.length === 0) continue

    const remaining = maxMatches - totalMatches
    const limitedMatches = fileMatches.slice(0, remaining)
    totalMatches += limitedMatches.length
    files.push({ relativePath, matches: limitedMatches })

    if (limitedMatches.length < fileMatches.length) {
      truncated = true
      break
    }
  }

  return {
    files,
    totalMatches,
    totalFiles: files.length,
    truncated
  }
}

export async function replaceInWorkspaceFiles(
  rootPath: string,
  options: WorkspaceReplaceOptions
): Promise<WorkspaceReplaceResult> {
  const search = await searchWorkspaceFiles(rootPath, options)
  if (search.invalidPattern) {
    return { filesChanged: 0, replacements: 0, errors: ['Invalid search pattern'] }
  }

  const regex = buildSearchRegex(options)
  if (!regex) {
    return { filesChanged: 0, replacements: 0, errors: ['Invalid search pattern'] }
  }

  let filesChanged = 0
  let replacements = 0
  const errors: string[] = []

  for (const file of search.files) {
    const filePath = resolveWithinRoot(rootPath, file.relativePath)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const fileRegex = new RegExp(regex.source, regex.flags)
      const { next, count } = replaceInContent(content, fileRegex, options.replacement)
      if (count === 0) continue
      await fs.writeFile(filePath, next, 'utf-8')
      filesChanged += 1
      replacements += count
    } catch (error) {
      errors.push(
        `${file.relativePath}: ${error instanceof Error ? error.message : 'replace failed'}`
      )
    }
  }

  return { filesChanged, replacements, errors }
}
