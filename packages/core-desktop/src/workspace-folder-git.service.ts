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
  getAuthenticatedUrl,
  getBundledGitBinary,
  mapWorkingStatus,
  pathsEqual
} from '@baishou/core/desktop'
import {
  parseGitNulSeparatedPaths,
  resolveWorkspaceFolderGitRoot
} from './workspace-folder-git.util'
import {
  getWorkspaceCommitChanges,
  getWorkspaceFileContentAtRevision,
  getWorkspaceFileDiff,
  getWorkspaceHistory,
  getWorkspaceHistoryCount,
  getWorkspaceRecentPulls,
  getWorkspaceWorkingDiff,
  rollbackWorkspaceFile
} from './workspace-folder-git-history'
import {
  getWorkspaceBranchInfo,
  getWorkspaceRollbackAllContext,
  listWorkspaceStash,
  stashWorkspaceApply,
  stashWorkspaceDrop,
  stashWorkspacePop,
  stashWorkspacePush
} from './workspace-folder-git-sync'
import { pathInScope, type WorkspaceGitContext } from './workspace-folder-git.types'

export type { WorkspaceGitBranchInfo, WorkspaceGitContext } from './workspace-folder-git.types'

const DEFAULT_IGNORE = [
  'node_modules/',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.baishou/workspace-git.json'
]
const WORKSPACE_GIT_CONFIG_FILE = '.baishou/workspace-git.json'
const DEFAULT_WORKSPACE_GIT_CONFIG: GitSyncConfig = { enabled: true }

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
      binary: getBundledGitBinary(),
      config: ['core.quotepath=false']
    })
  }

  private async resolveContext(): Promise<WorkspaceGitContext> {
    if (this.context) return this.context
    this.context = resolveWorkspaceFolderGitRoot(this.folderRoot)
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
    const context = resolveWorkspaceFolderGitRoot(this.folderRoot)
    const git = this.createGit(context.folderRoot)
    await git.init()
    this.context = context
    this.git = git
    await this.ensureAuthor(git)
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

  private async listStagedPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['diff', '--cached', '--name-only', '-z'])
    return parseGitNulSeparatedPaths(output)
  }

  async commitStaged(message: string): Promise<GitCommit | null> {
    const { git } = await this.ensureGit()
    const files = await this.listStagedPaths(git)
    if (files.length === 0) return null
    await this.ensureAuthor(git)
    const finalMessage = resolveGitCommitMessage(message)
    const result = await git.commit(finalMessage)
    if (!result.commit) return null
    return {
      hash: result.commit.substring(0, 7),
      message: finalMessage,
      date: new Date(),
      files
    }
  }

  async commitAll(message: string): Promise<GitCommit | null> {
    await this.stageAll()
    return this.commitStaged(message)
  }

  async getHistoryCount(filePath?: string): Promise<number> {
    const { git } = await this.ensureGit()
    return getWorkspaceHistoryCount(git, filePath)
  }

  async getHistory(filePath?: string, limit = 50, offset = 0): Promise<VersionHistoryEntry[]> {
    const { git } = await this.ensureGit()
    return getWorkspaceHistory(git, filePath, limit, offset)
  }

  async getRecentPulls(limit = 10): Promise<VersionHistoryEntry[]> {
    const { git } = await this.ensureGit()
    return getWorkspaceRecentPulls(git, limit)
  }

  async getCommitChanges(commitHash: string): Promise<FileChange[]> {
    const { git } = await this.ensureGit()
    return getWorkspaceCommitChanges(git, commitHash)
  }

  async getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff> {
    const { git } = await this.ensureGit()
    return getWorkspaceFileDiff(git, filePath, commitHash)
  }

  async getFileContentAtRevision(filePath: string, revision: string): Promise<string | null> {
    const { git } = await this.ensureGit()
    return getWorkspaceFileContentAtRevision(git, filePath, revision)
  }

  async getHeadFileContent(filePath: string): Promise<string | null> {
    return this.getFileContentAtRevision(filePath, 'HEAD')
  }

  async getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff> {
    const { git, context } = await this.ensureGit()
    return getWorkspaceWorkingDiff(git, context, filePath, staged)
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
    return rollbackWorkspaceFile(git, context, filePath, commitHash)
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
    return getWorkspaceRollbackAllContext(git, status, commitHash)
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

  async getCurrentBranchName(): Promise<string> {
    const { git } = await this.ensureGit()
    return (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
  }

  async getBranchInfo() {
    const { git } = await this.ensureGit()
    return getWorkspaceBranchInfo(git)
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
    return listWorkspaceStash(git)
  }

  async stashPush(message?: string): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    return stashWorkspacePush(git, message)
  }

  async stashApply(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    return stashWorkspaceApply(git, index)
  }

  async stashPop(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    return stashWorkspacePop(git, index)
  }

  async stashDrop(index: number): Promise<{ success: boolean; message?: string }> {
    const { git } = await this.ensureGit()
    return stashWorkspaceDrop(git, index)
  }
}
