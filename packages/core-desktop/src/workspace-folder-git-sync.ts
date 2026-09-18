import type { SimpleGit } from 'simple-git'
import type { GitRollbackAllContext, GitStashEntry, GitStatus } from '@baishou/shared'
import type { WorkspaceGitBranchInfo } from './workspace-folder-git.types'

export function stripCredentialsFromUrl(url: string): string {
  return url.replace(/^(https?:\/\/)(?:[^@/]+@)/i, '$1')
}

export async function getWorkspaceRollbackAllContext(
  git: SimpleGit,
  status: GitStatus,
  commitHash: string
): Promise<GitRollbackAllContext> {
  let commitsAfterTarget = 0
  try {
    const log = await git.log({ from: commitHash, to: 'HEAD' })
    commitsAfterTarget = Math.max(0, log.total - 1)
  } catch {
    commitsAfterTarget = 0
  }
  const remotes = await git.getRemotes(true)
  return {
    hasRemote: remotes.some((remote) => remote.name === 'origin'),
    hasUncommittedChanges: status.hasChanges,
    commitsAfterTarget
  }
}

export async function getWorkspaceBranchInfo(git: SimpleGit): Promise<WorkspaceGitBranchInfo> {
  const current = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
  const localBranches = (await git.branchLocal()).all.filter((branch) => branch !== 'HEAD')
  const remotes = await git.getRemotes(true)
  const hasRemote = remotes.some((remote) => remote.name === 'origin')
  let ahead = 0
  let behind = 0
  let remoteUrl: string | undefined

  if (hasRemote) {
    try {
      const url = await git.getConfig('remote.origin.url')
      remoteUrl = url.value ? stripCredentialsFromUrl(url.value) : undefined
    } catch {
      const raw = remotes.find((remote) => remote.name === 'origin')?.refs?.fetch
      remoteUrl = raw ? stripCredentialsFromUrl(raw) : undefined
    }

    try {
      const upstream = (await git.revparse(['--abbrev-ref', '--symbolic-full-name', '@{u}'])).trim()
      const counts = (
        await git.raw(['rev-list', '--left-right', '--count', `${upstream}...HEAD`])
      ).trim()
      const [behindCount, aheadCount] = counts.split(/\s+/)
      behind = Number.parseInt(behindCount ?? '0', 10) || 0
      ahead = Number.parseInt(aheadCount ?? '0', 10) || 0
    } catch {
      ahead = 0
      behind = 0
    }
  }

  return {
    current,
    branches: localBranches,
    hasRemote,
    ahead,
    behind,
    remoteUrl
  }
}

export async function listWorkspaceStash(git: SimpleGit): Promise<GitStashEntry[]> {
  try {
    const list = await git.stashList()
    return list.all.map((entry, index) => ({
      index,
      message: entry.message,
      date: new Date(entry.date),
      branch: entry.message.match(/^WIP on ([^:]+):/)?.[1]?.trim() ?? ''
    }))
  } catch {
    return []
  }
}

export async function stashWorkspacePush(
  git: SimpleGit,
  message?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const args = ['push']
    if (message?.trim()) {
      args.push('-m', message.trim())
    }
    await git.stash(args)
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function stashWorkspaceApply(
  git: SimpleGit,
  index: number
): Promise<{ success: boolean; message?: string }> {
  try {
    await git.stash(['apply', `stash@{${index}}`])
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function stashWorkspacePop(
  git: SimpleGit,
  index: number
): Promise<{ success: boolean; message?: string }> {
  try {
    await git.stash(['pop', `stash@{${index}}`])
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function stashWorkspaceDrop(
  git: SimpleGit,
  index: number
): Promise<{ success: boolean; message?: string }> {
  try {
    await git.stash(['drop', `stash@{${index}}`])
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}
