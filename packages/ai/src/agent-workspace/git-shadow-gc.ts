import {
  SNAPSHOT_REF_PREFIX,
  snapshotRefName,
  type WorkspaceGitRunner
} from './git-shadow-snapshot.store'
import type { KeyedMutex } from './keyed-mutex'

export interface ShadowGitGcOptions {
  runGit: WorkspaceGitRunner
  gitDir: string
  folderRoot: string
  /** 仍被检查点引用的 tree oid。不在这个集合里的快照引用会被删掉，随后被 gc 回收 */
  liveTreeOids: Iterable<string>
  /** 与快照 store 共用的锁，避免 gc 与 capture 抢 index.lock */
  mutex?: KeyedMutex
  timeoutMs?: number
  onWarn?: (message: string, detail?: Record<string, unknown>) => void
}

export interface ShadowGitGcResult {
  /** 删掉的过期快照引用数量 */
  releasedRefs: number
  /** gc 是否真的跑了。引用对不上时会主动放弃，宁可占着磁盘也不冒删错对象的风险 */
  collected: boolean
}

/**
 * 回收影子仓库里已经没人要的快照。
 *
 * 判断依据只有一个：检查点还在不在。因此这里先拿检查点里的 tree oid 去校准引用
 * ——补上缺的、删掉多的——再让 git 按可达性回收。任何一步对不上就跳过 gc：
 * 引用少挂一个，被回收的就是某个检查点的全部正文，那个会话从此回滚不了。
 */
export async function pruneShadowSnapshotObjects(
  options: ShadowGitGcOptions
): Promise<ShadowGitGcResult> {
  const { gitDir, folderRoot, mutex } = options
  const task = (): Promise<ShadowGitGcResult> => collect(options)
  return mutex ? mutex.run(gitDir, task) : task()
}

async function collect(options: ShadowGitGcOptions): Promise<ShadowGitGcResult> {
  const { gitDir, folderRoot, timeoutMs } = options

  const git = (args: string[], stdin?: string) =>
    options.runGit({
      args: ['--git-dir', gitDir, '--work-tree', folderRoot, ...args],
      cwd: folderRoot,
      stdin,
      timeoutMs
    })

  const listed = await git(['for-each-ref', '--format=%(refname)', SNAPSHOT_REF_PREFIX])
  if (listed.code !== 0) {
    options.onWarn?.('shadow gc: cannot list snapshot refs, skipping', {
      stderr: listed.stderr.trim()
    })
    return { releasedRefs: 0, collected: false }
  }

  const existing = new Set(
    listed.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  )
  const live = new Set(options.liveTreeOids)

  const missing = [...live].filter((oid) => !existing.has(snapshotRefName(oid)))
  const stale = [...existing].filter((ref) => !live.has(ref.slice(SNAPSHOT_REF_PREFIX.length)))

  if (missing.length > 0) {
    const restored = await git(
      ['update-ref', '--stdin'],
      missing.map((oid) => `update ${snapshotRefName(oid)} ${oid}\n`).join('')
    )
    // 对象已经不在了才会失败，此时无从判断还缺多少，只能整体放弃
    if (restored.code !== 0) {
      options.onWarn?.('shadow gc: cannot re-anchor live snapshots, skipping', {
        count: missing.length,
        stderr: restored.stderr.trim()
      })
      return { releasedRefs: 0, collected: false }
    }
  }

  if (stale.length > 0) {
    const released = await git(
      ['update-ref', '--stdin'],
      stale.map((ref) => `delete ${ref}\n`).join('')
    )
    if (released.code !== 0) {
      options.onWarn?.('shadow gc: cannot release stale snapshot refs, skipping', {
        count: stale.length,
        stderr: released.stderr.trim()
      })
      return { releasedRefs: 0, collected: false }
    }
  }

  const collected = await git(['gc', '--prune=now', '--quiet'])
  if (collected.code !== 0) {
    options.onWarn?.('shadow gc: git gc failed', { stderr: collected.stderr.trim() })
    return { releasedRefs: stale.length, collected: false }
  }

  return { releasedRefs: stale.length, collected: true }
}
