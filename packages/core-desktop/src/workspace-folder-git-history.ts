import * as fs from 'fs'
import * as path from 'path'
import type { SimpleGit } from 'simple-git'
import type { FileChange, FileDiff, VersionHistoryEntry } from '@baishou/shared'
import {
  buildNewFileDiffHunks,
  isTextDiffablePath,
  mapStatusToType,
  parseDiffHunks,
  parseGitHistoryLog,
  parseRevListCount,
  pathsEqual,
  unquoteGitPath
} from '@baishou/core/desktop'
import { toGitShowSpec, toWorkspaceHistoryEntries } from './workspace-folder-git.util'
import type { WorkspaceGitContext } from './workspace-folder-git.types'

export async function getWorkspaceHistoryCount(git: SimpleGit, filePath?: string): Promise<number> {
  try {
    const args = ['rev-list', '--count', 'HEAD']
    if (filePath) args.push('--', filePath)
    return parseRevListCount(await git.raw(args))
  } catch {
    return 0
  }
}

export async function getWorkspaceHistory(
  git: SimpleGit,
  filePath?: string,
  limit = 50,
  offset = 0
): Promise<VersionHistoryEntry[]> {
  try {
    const headRef = (await git.revparse(['HEAD'])).trim()
    const args = [
      'log',
      `--max-count=${Math.max(0, limit)}`,
      `--skip=${Math.max(0, offset)}`,
      '--format=%H%x1f%s%x1f%aI'
    ]
    if (filePath) args.push('--', filePath)
    const output = await git.raw(args)
    return toWorkspaceHistoryEntries(parseGitHistoryLog(output), headRef)
  } catch {
    return []
  }
}

export async function getWorkspaceRecentPulls(
  git: SimpleGit,
  limit = 10
): Promise<VersionHistoryEntry[]> {
  try {
    const log = await git.log(['origin/HEAD', '--max-count', String(limit)])
    return log.all.map((commit) => ({
      commit: {
        hash: commit.hash.substring(0, 7),
        message: commit.message,
        date: new Date(commit.date),
        files: []
      },
      changes: [],
      isCurrent: false
    }))
  } catch {
    return []
  }
}

export async function getWorkspaceCommitChanges(
  git: SimpleGit,
  commitHash: string
): Promise<FileChange[]> {
  const toChange = (
    file: { file: string; status?: string; insertions?: number; deletions?: number },
    fallbackStatus: FileChange['status']
  ): FileChange => ({
    path: unquoteGitPath(file.file),
    status: file.status ? mapStatusToType(file.status) : fallbackStatus,
    additions: file.insertions ?? 0,
    deletions: file.deletions ?? 0
  })
  try {
    const diff = await git.diffSummary([`${commitHash}~1`, commitHash])
    return diff.files.map((file) => toChange(file, mapStatusToType('M')))
  } catch {
    try {
      const diff = await git.diffSummary([commitHash])
      return diff.files.map((file) => toChange(file, 'added'))
    } catch {
      return []
    }
  }
}

export async function getWorkspaceFileDiff(
  git: SimpleGit,
  filePath: string,
  commitHash?: string
): Promise<FileDiff> {
  if (!isTextDiffablePath(filePath)) return { path: filePath, hunks: [] }
  const toFileDiff = (diff: string): FileDiff => ({ path: filePath, hunks: parseDiffHunks(diff) })

  if (commitHash) {
    try {
      const diff = await git.diff([`${commitHash}~1`, commitHash, '--', filePath])
      if (diff.trim()) return toFileDiff(diff)
    } catch {
      /* first commit */
    }
    try {
      const diff = await git.diff(['--root', commitHash, '--', filePath])
      if (diff.trim()) return toFileDiff(diff)
    } catch {
      return { path: filePath, hunks: [] }
    }
    return { path: filePath, hunks: [] }
  }

  try {
    const diff = await git.diff(['HEAD~1', 'HEAD', '--', filePath])
    return toFileDiff(diff)
  } catch {
    return { path: filePath, hunks: [] }
  }
}

export async function getWorkspaceFileContentAtRevision(
  git: SimpleGit,
  filePath: string,
  revision: string
): Promise<string | null> {
  if (!isTextDiffablePath(filePath)) return null
  const spec = toGitShowSpec(revision, filePath)
  try {
    const content = await git.show([spec])
    return typeof content === 'string' ? content : null
  } catch {
    return null
  }
}

export async function getWorkspaceWorkingDiff(
  git: SimpleGit,
  context: WorkspaceGitContext,
  filePath: string,
  staged: boolean
): Promise<FileDiff> {
  if (!isTextDiffablePath(filePath)) return { path: filePath, hunks: [] }

  if (!staged) {
    const status = await git.status()
    const isUntracked = status.not_added.some((entry) => pathsEqual(entry, filePath))
    if (isUntracked) {
      try {
        const fullPath = path.join(context.gitRoot, filePath)
        const content = await fs.promises.readFile(fullPath, 'utf8')
        return { path: filePath, hunks: buildNewFileDiffHunks(content) }
      } catch {
        return { path: filePath, hunks: [] }
      }
    }
  }

  const args = staged
    ? ['--cached', '--submodule=short', '--', filePath]
    : ['--submodule=short', '--', filePath]
  try {
    const diff = await git.diff(args)
    return { path: filePath, hunks: parseDiffHunks(diff) }
  } catch {
    return { path: filePath, hunks: [] }
  }
}

export async function rollbackWorkspaceFile(
  git: SimpleGit,
  context: WorkspaceGitContext,
  filePath: string,
  commitHash: string
): Promise<{ success: boolean }> {
  try {
    await git.raw(['restore', '--source', `${commitHash}~1`, '--worktree', '--', filePath])
    return { success: true }
  } catch {
    try {
      const fullPath = path.join(context.gitRoot, filePath)
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath)
      }
      return { success: true }
    } catch {
      return { success: false }
    }
  }
}
