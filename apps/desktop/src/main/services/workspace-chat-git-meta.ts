import { getWorkspaceFolderGitService } from './workspace-folder-git.registry'
import { countWorkspaceGitChanges } from './workspace-chat-git.util'

export type WorkspaceGitMetaLight = {
  isGitRepo: boolean
  gitBranch?: string | null
  gitChangesCount?: number | null
}

const GIT_META_TTL_MS = 10_000
const gitMetaCache = new Map<string, { expiresAt: number; value: WorkspaceGitMetaLight }>()

/** 轻量 git 元数据：分支名用 rev-parse；变更数用 status length；短 TTL 复用 */
export async function resolveWorkspaceGitMetaLight(
  folderRoot: string
): Promise<WorkspaceGitMetaLight> {
  const cached = gitMetaCache.get(folderRoot)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const git = getWorkspaceFolderGitService(folderRoot)
  const initialized = await git.isInitialized()
  let value: WorkspaceGitMetaLight = { isGitRepo: false }
  if (initialized) {
    const [branch, status] = await Promise.all([
      git.getCurrentBranchName().catch(() => null),
      git.getStatus().catch(() => null)
    ])
    value = {
      isGitRepo: true,
      gitBranch: branch,
      gitChangesCount: countWorkspaceGitChanges(status)
    }
  }

  gitMetaCache.set(folderRoot, { expiresAt: Date.now() + GIT_META_TTL_MS, value })
  return value
}
