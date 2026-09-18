import type { GitSyncConfig } from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from './create-mobile-file-system'
import { isMobileGitHttpRemote } from './mobile-git-vault.util'

export { isMobileGitHttpRemote, mobileGitUnsupportedAction } from './mobile-git-vault.util'

const GIT_SYNC_CONFIG_FILE = '.baishou-git.json'
const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  enabled: false,
  userName: 'BaiShou',
  userEmail: 'baishou@local'
}

function joinPath(base: string, ...parts: string[]): string {
  return [base.replace(/[\\/]+$/, ''), ...parts].join('/').replace(/\\/g, '/')
}

async function requireRoot(): Promise<string> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.pathService) throw new Error('runtime not ready')
  return runtime.pathService.getRootDirectory()
}

export async function mobileGitGetConfig(): Promise<GitSyncConfig> {
  const fs = createMobileFileSystem()
  const file = joinPath(await requireRoot(), GIT_SYNC_CONFIG_FILE)
  try {
    const raw = JSON.parse(await fs.readFile(file)) as GitSyncConfig
    return { ...DEFAULT_GIT_SYNC_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_GIT_SYNC_CONFIG }
  }
}

export async function mobileGitUpdateConfig(patch: Partial<GitSyncConfig>): Promise<GitSyncConfig> {
  const fs = createMobileFileSystem()
  const next = { ...(await mobileGitGetConfig()), ...patch }
  const file = joinPath(await requireRoot(), GIT_SYNC_CONFIG_FILE)
  await fs.writeFile(file, JSON.stringify(next, null, 2))
  return next
}

export async function mobileGitIsInitialized(): Promise<boolean> {
  const fs = createMobileFileSystem()
  return fs.exists(joinPath(await requireRoot(), '.git'))
}

export async function mobileGitInit(): Promise<void> {
  const fs = createMobileFileSystem()
  const root = await requireRoot()
  const gitDir = joinPath(root, '.git')
  if (await fs.exists(gitDir)) return
  await fs.mkdir(joinPath(gitDir, 'objects'), { recursive: true })
  await fs.mkdir(joinPath(gitDir, 'refs', 'heads'), { recursive: true })
  await fs.writeFile(joinPath(gitDir, 'HEAD'), 'ref: refs/heads/main\n')
  await fs.writeFile(
    joinPath(gitDir, 'config'),
    '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n'
  )
}

export async function mobileGitTestRemote(url?: string): Promise<{ ok: boolean; message: string }> {
  const target = (url || (await mobileGitGetConfig()).remote?.url || '').trim()
  if (!target) return { ok: false, message: '未填写远程地址' }
  try {
    if (!isMobileGitHttpRemote(target)) {
      return { ok: false, message: '仅支持 http/https 远程探测' }
    }
    const res = await fetch(target, { method: 'HEAD' })
    return res.ok || res.status === 401 || res.status === 403
      ? { ok: true, message: `远程可访问（HTTP ${res.status}）` }
      : { ok: false, message: `远程返回 HTTP ${res.status}` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
