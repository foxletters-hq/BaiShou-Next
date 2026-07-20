import * as fs from 'fs'
import * as path from 'path'
import simpleGit, { type SimpleGit } from 'simple-git'
import { logger, resolveGitCommitMessage } from '@baishou/shared'
import type {
  FileChange,
  FileDiff,
  GitCommit,
  GitRollbackAllContext,
  GitStashEntry,
  GitStatus,
  GitStatusFile,
  GitSyncConfig,
  VersionHistoryEntry
} from '@baishou/shared'
import {
  applyGitProcessEnv,
  buildNewFileDiffHunks,
  getAuthenticatedUrl,
  getBundledGitBinary,
  isTextDiffablePath,
  mapStatusToType,
  mapWorkingStatus,
  parseDiffHunks,
  pathsEqual
} from '@baishou/core/desktop'

const DEFAULT_IGNORE = [
  'node_modules/',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.baishou/workspace-git.json'
]
const WORKSPACE_GIT_CONFIG_FILE = '.baishou/workspace-git.json'
const DEFAULT_WORKSPACE_GIT_CONFIG: GitSyncConfig = { enabled: true }

export interface WorkspaceGitContext {
  folderRoot: string
  gitRoot: string
  scopePrefix: string
}

export interface WorkspaceGitBranchInfo {
  current: string
  branches: string[]
  hasRemote: boolean
  ahead: number
  behind: number
  remoteUrl?: string
}

function normalizePosix(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

function pathInScope(filePath: string, scopePrefix: string): boolean {
  const normalized = normalizePosix(filePath)
  if (!scopePrefix) return true
  return normalized === scopePrefix || normalized.startsWith(`${scopePrefix}/`)
}

function filterStatus(status: GitStatus, scopePrefix: string): GitStatus {
  const filterFiles = (files: GitStatusFile[]) =>
    files.filter((file) => pathInScope(file.path, scopePrefix))
  const untracked = status.untracked.filter((filePath: string) =>
    pathInScope(filePath, scopePrefix)
  )
  const conflicted = status.conflicted.filter((filePath: string) =>
    pathInScope(filePath, scopePrefix)
  )
  const staged = filterFiles(status.staged)
  const unstaged = filterFiles(status.unstaged)
  return {
    staged,
    unstaged,
    untracked,
    conflicted,
    hasChanges:
      staged.length > 0 || unstaged.length > 0 || untracked.length > 0 || conflicted.length > 0
  }
}

export class WorkspaceFolderGitService {
  private git: SimpleGit | null = null
  private context: WorkspaceGitContext | null = null

  constructor(private readonly folderRoot: string) {}

  private createGit(baseDir: string): SimpleGit {
    applyGitProcessEnv()
    return simpleGit({
      baseDir,
      binary: getBundledGitBinary()
    })
  }

  private async resolveContext(): Promise<WorkspaceGitContext> {
    if (this.context) return this.context

    const folderRoot = path.resolve(this.folderRoot)
    let current = folderRoot
    while (true) {
      if (fs.existsSync(path.join(current, '.git'))) {
        const scopePrefix = normalizePosix(path.relative(current, folderRoot))
        this.context = {
          folderRoot,
          gitRoot: current,
          scopePrefix: scopePrefix === '.' ? '' : scopePrefix
        }
        return this.context
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }

    this.context = { folderRoot, gitRoot: folderRoot, scopePrefix: '' }
    return this.context
  }

  private async ensureGit(): Promise<{ git: SimpleGit; context: WorkspaceGitContext }> {
    const context = await this.resolveContext()
    if (!this.git || this.context?.gitRoot !== context.gitRoot) {
      this.git = this.createGit(context.gitRoot)
    }
    return { git: this.git, context }
  }

  async isInitialized(): Promise<boolean> {
    const context = await this.resolveContext()
    return fs.existsSync(path.join(context.gitRoot, '.git'))
  }

  async init(): Promise<void> {
    const context = await this.resolveContext()
    const git = this.createGit(context.folderRoot)
    await git.init()
    const gitignorePath = path.join(context.folderRoot, '.gitignore')
    if (!fs.existsSync(gitignorePath)) {
      await fs.promises.writeFile(gitignorePath, `${DEFAULT_IGNORE.join('\n')}\n`, 'utf8')
      await git.add('.gitignore')
      try {
        await git.commit('Initialize repository')
      } catch {
        /* empty repo */
      }
    }
    this.context = {
      folderRoot: context.folderRoot,
      gitRoot: context.folderRoot,
      scopePrefix: ''
    }
    this.git = this.createGit(context.folderRoot)
  }

  async getStatus(): Promise<GitStatus> {
    const { git, context } = await this.ensureGit()
    const status = await git.status()
    const staged: GitStatusFile[] = []
    const unstaged: GitStatusFile[] = []

    for (const file of status.files) {
      if (file.index === '?' || file.working_dir === '?') continue
      const stagedStatus = mapWorkingStatus(file.index)
      const unstagedStatus = mapWorkingStatus(file.working_dir)
      if (stagedStatus) {
        staged.push({ path: file.path, stagedStatus, unstagedStatus: '' })
      }
      if (unstagedStatus) {
        unstaged.push({ path: file.path, stagedStatus: '', unstagedStatus })
      }
    }

    return filterStatus(
      {
        staged,
        unstaged,
        untracked: status.not_added,
        conflicted: status.conflicted,
        hasChanges: !status.isClean()
      },
      context.scopePrefix
    )
  }

  async stageFile(filePath: string): Promise<void> {
    const { git } = await this.ensureGit()
    await git.add(filePath)
  }

  async stageAll(): Promise<void> {
    const { git } = await this.ensureGit()
    await git.add('.')
  }

  async unstageFile(filePath: string): Promise<void> {
    const { git } = await this.ensureGit()
    await git.reset(['--', filePath])
  }

  async unstageAll(): Promise<void> {
    const { git } = await this.ensureGit()
    await git.reset(['--mixed'])
  }

  async discardFile(filePath: string): Promise<void> {
    const { git } = await this.ensureGit()
    const status = await git.status()
    const isUntracked = status.not_added.some((entry) => pathsEqual(entry, filePath))
    if (isUntracked) {
      await git.clean('f', ['--', filePath])
      return
    }
    await git.checkout(['--', filePath])
  }

  async discardAllChanges(): Promise<void> {
    const { git } = await this.ensureGit()
    await git.checkout(['--', '.'])
    await git.clean('f', ['-d'])
  }

  private async ensureAuthor(git: SimpleGit): Promise<void> {
    const config = await this.getConfig()
    const name =
      config.userName || (await git.getConfig('user.name').catch(() => ({ value: '' }))).value
    const email =
      config.userEmail || (await git.getConfig('user.email').catch(() => ({ value: '' }))).value
    if (!name) await git.addConfig('user.name', 'BaiShou User', false, 'local')
    else await git.addConfig('user.name', name, false, 'local')
    if (!email) await git.addConfig('user.email', 'user@local.baishou', false, 'local')
    else await git.addConfig('user.email', email, false, 'local')
  }

  private configFilePath(): string {
    return path.join(this.folderRoot, WORKSPACE_GIT_CONFIG_FILE)
  }

  private stripCredentialsFromUrl(url: string): string {
    return url.replace(/^(https?:\/\/)(?:[^@/]+@)/i, '$1')
  }

  async getConfig(): Promise<GitSyncConfig> {
    const configPath = this.configFilePath()
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_WORKSPACE_GIT_CONFIG }
    }
    try {
      const raw = await fs.promises.readFile(configPath, 'utf8')
      const saved = JSON.parse(raw) as Partial<GitSyncConfig>
      return { ...DEFAULT_WORKSPACE_GIT_CONFIG, ...saved }
    } catch {
      return { ...DEFAULT_WORKSPACE_GIT_CONFIG }
    }
  }

  async saveConfig(partial: Partial<GitSyncConfig>): Promise<void> {
    const current = await this.getConfig()
    const next: GitSyncConfig = {
      ...current,
      ...partial,
      remote: partial.remote ? { ...current.remote, ...partial.remote } : current.remote
    }
    await fs.promises.mkdir(path.dirname(this.configFilePath()), { recursive: true })
    await fs.promises.writeFile(this.configFilePath(), JSON.stringify(next, null, 2), 'utf8')

    const { git } = await this.ensureGit()
    if (next.userName) await git.addConfig('user.name', next.userName, false, 'local')
    if (next.userEmail) await git.addConfig('user.email', next.userEmail, false, 'local')
    if (next.remote?.url) {
      await this.ensureRemote(next)
    }
  }

  private async ensureRemote(config?: GitSyncConfig): Promise<void> {
    const cfg = config ?? (await this.getConfig())
    const url = cfg.remote?.url?.trim()
    if (!url) {
      throw new Error('Remote repository is not configured')
    }
    const { git } = await this.ensureGit()
    const authenticatedUrl = getAuthenticatedUrl(url, cfg.remote?.username, cfg.remote?.token)
    const remotes = await git.getRemotes()
    if (!remotes.some((remote) => remote.name === 'origin')) {
      await git.addRemote('origin', authenticatedUrl)
      return
    }
    await git.remote(['set-url', 'origin', authenticatedUrl])
  }

  async testRemote(): Promise<boolean> {
    try {
      await this.ensureRemote()
      const { git } = await this.ensureGit()
      await git.listRemote(['--heads', 'origin'])
      return true
    } catch {
      return false
    }
  }

  async commitStaged(message: string): Promise<GitCommit | null> {
    const { git } = await this.ensureGit()
    await this.ensureAuthor(git)
    const finalMessage = resolveGitCommitMessage(message)
    const result = await git.commit(finalMessage)
    if (!result.commit) return null
    return {
      hash: result.commit.substring(0, 7),
      message: finalMessage,
      date: new Date(),
      files: result.summary.changes ? [] : []
    }
  }

  async commitAll(message: string): Promise<GitCommit | null> {
    await this.stageAll()
    return this.commitStaged(message)
  }

  async getHistory(filePath?: string, limit = 50): Promise<VersionHistoryEntry[]> {
    const { git } = await this.ensureGit()
    const options = ['--max-count', String(limit)]
    if (filePath) options.push('--', filePath)
    try {
      const log = await git.log(options)
      const entries: VersionHistoryEntry[] = []
      for (const commit of log.all) {
        const changes = await this.getCommitChanges(commit.hash)
        entries.push({
          commit: {
            hash: commit.hash.substring(0, 7),
            message: commit.message,
            date: new Date(commit.date),
            files: changes.map((change) => change.path)
          },
          changes,
          isCurrent: entries.length === 0
        })
      }
      return entries
    } catch {
      return []
    }
  }

  async getRecentPulls(limit = 10): Promise<VersionHistoryEntry[]> {
    const { git } = await this.ensureGit()
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

  async getCommitChanges(commitHash: string): Promise<FileChange[]> {
    const { git } = await this.ensureGit()
    try {
      const diff = await git.diffSummary([`${commitHash}~1`, commitHash])
      return diff.files.map((file) => ({
        path: file.file,
        status: mapStatusToType((file as { status?: string }).status ?? 'M'),
        additions: 'insertions' in file ? file.insertions : 0,
        deletions: 'deletions' in file ? file.deletions : 0
      }))
    } catch {
      try {
        const diff = await git.diffSummary([commitHash])
        return diff.files.map((file) => ({
          path: file.file,
          status: 'added' as FileChange['status'],
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0
        }))
      } catch {
        return []
      }
    }
  }

  async getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff> {
    if (!isTextDiffablePath(filePath)) return { path: filePath, hunks: [] }
    const { git } = await this.ensureGit()
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

  /** 读取 HEAD 中的文件内容；未跟踪或新文件返回 null */
  async getHeadFileContent(filePath: string): Promise<string | null> {
    if (!isTextDiffablePath(filePath)) return null
    const { git } = await this.ensureGit()
    const normalized = filePath.replace(/\\/g, '/')
    try {
      const content = await git.show([`HEAD:${normalized}`])
      return typeof content === 'string' ? content : null
    } catch {
      return null
    }
  }

  async getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff> {
    if (!isTextDiffablePath(filePath)) return { path: filePath, hunks: [] }
    const { git, context } = await this.ensureGit()

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

  async hasConflicts(): Promise<boolean> {
    const status = await this.getStatus()
    return status.conflicted.length > 0
  }

  async getConflicts(): Promise<string[]> {
    const status = await this.getStatus()
    return status.conflicted
  }

  async resolveConflict(
    filePath: string,
    resolution: 'ours' | 'theirs'
  ): Promise<{ success: boolean }> {
    const { git } = await this.ensureGit()
    try {
      await git.checkout([`--${resolution}`, '--', filePath])
      await git.add(filePath)
      return { success: true }
    } catch (error) {
      logger.warn(
        '[WorkspaceGit] resolve conflict failed:',
        error instanceof Error ? error : new Error(String(error))
      )
      return { success: false }
    }
  }

  async rollbackFile(filePath: string, commitHash: string): Promise<{ success: boolean }> {
    const { git, context } = await this.ensureGit()
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

  async rollbackAll(commitHash: string): Promise<{ success: boolean }> {
    const { git } = await this.ensureGit()
    try {
      await git.reset(['--hard', commitHash])
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  async getRollbackAllContext(commitHash: string): Promise<GitRollbackAllContext> {
    const { git } = await this.ensureGit()
    const status = await this.getStatus()
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

  async push(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureRemote()
      const config = await this.getConfig()
      const branch = config.remote?.branch || (await this.getBranchInfo()).current
      const { git } = await this.ensureGit()
      await git.push('origin', branch)
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async pull(): Promise<{ success: boolean; message?: string; conflicts?: string[] }> {
    try {
      await this.ensureRemote()
      const config = await this.getConfig()
      const branch = config.remote?.branch || (await this.getBranchInfo()).current
      const { git } = await this.ensureGit()
      await git.pull('origin', branch)
      const conflicts = await this.getConflicts()
      return { success: true, conflicts }
    } catch (error) {
      const conflicts = await this.getConflicts()
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        conflicts
      }
    }
  }

  async getBranchInfo(): Promise<WorkspaceGitBranchInfo> {
    const { git } = await this.ensureGit()
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
        remoteUrl = url.value ? this.stripCredentialsFromUrl(url.value) : undefined
      } catch {
        const raw = remotes.find((remote) => remote.name === 'origin')?.refs?.fetch
        remoteUrl = raw ? this.stripCredentialsFromUrl(raw) : undefined
      }

      try {
        const upstream = (
          await git.revparse(['--abbrev-ref', '--symbolic-full-name', '@{u}'])
        ).trim()
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

  async checkoutBranch(branch: string): Promise<void> {
    const { git } = await this.ensureGit()
    await git.checkout(branch)
  }

  async createBranch(branch: string): Promise<void> {
    const { git } = await this.ensureGit()
    await git.checkoutLocalBranch(branch)
  }

  async setRemoteUrl(url: string): Promise<void> {
    const current = await this.getConfig()
    await this.saveConfig({
      remote: {
        url: url.trim(),
        branch: current.remote?.branch || 'main',
        username: current.remote?.username,
        token: current.remote?.token
      }
    })
  }

  async mergeBranch(branch: string): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    try {
      await git.merge([branch])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteBranch(
    branch: string,
    force = false
  ): Promise<{ success: boolean; message?: string }> {
    const info = await this.getBranchInfo()
    if (info.current === branch) {
      return { success: false, message: 'Cannot delete the current branch' }
    }
    const { git } = await this.ensureGit()
    try {
      await git.branch([force ? '-D' : '-d', branch])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async publishBranch(branch?: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureRemote()
      const { git } = await this.ensureGit()
      const target = branch?.trim() || (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
      await git.push(['-u', 'origin', target])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async listStash(): Promise<GitStashEntry[]> {
    const { git } = await this.ensureGit()
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

  async stashPush(message?: string): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
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

  async stashApply(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    try {
      await git.stash(['apply', `stash@{${index}}`])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async stashPop(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    try {
      await git.stash(['pop', `stash@{${index}}`])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async stashDrop(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    try {
      await git.stash(['drop', `stash@{${index}}`])
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}
