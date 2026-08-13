import { join } from 'node:path'
import { createNodeGitShadowFs, type GitShadowFs } from './git-shadow-fs'
import { createKeyedMutex, type KeyedMutex } from './keyed-mutex'
import { normalizeWorkspaceRelativePath, resolveWorkspacePath } from './workspace-path.sandbox'
import {
  buildSnapshotExcludeFile,
  chunkPathspecs,
  DEFAULT_MAX_UNTRACKED_FILE_BYTES,
  filterOversizedPaths,
  joinNulSeparated,
  splitNulSeparated
} from './workspace-snapshot-exclude'
import {
  emptyRestoreResult,
  isGitSnapshotHandle,
  type WorkspaceSnapshotStore
} from './workspace-snapshot-store'

export interface WorkspaceGitCommandResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export type WorkspaceGitRunner = (input: {
  args: string[]
  cwd?: string
  stdin?: string
  timeoutMs?: number
}) => Promise<WorkspaceGitCommandResult>

export interface GitShadowSnapshotStoreOptions {
  runGit: WorkspaceGitRunner
  /** 影子仓库 GIT_DIR 的位置，必须按工作台文件夹隔离 */
  resolveGitDir: (folderRoot: string) => string
  fs?: GitShadowFs
  mutex?: KeyedMutex
  maxUntrackedFileBytes?: number
  /** 单次快照允许纳入的路径数上限，用于挡住「把整个用户主目录绑成工作台」这类场景 */
  maxSnapshotFileCount?: number
  commandTimeoutMs?: number
  onWarn?: (message: string, detail?: Record<string, unknown>) => void
}

/**
 * 快照引用的命名空间。
 *
 * `write-tree` 产出的树没有任何引用指向它，在 git 眼里就是垃圾对象，一次 gc 就会被回收。
 * 所以每拍一张快照都要顺手挂一个引用，让这棵树在检查点还活着的期间保持可达。
 */
export const SNAPSHOT_REF_PREFIX = 'refs/snapshots/'

export function snapshotRefName(treeOid: string): string {
  return `${SNAPSHOT_REF_PREFIX}${treeOid}`
}

export class GitShadowSnapshotError extends Error {
  readonly stderr: string

  constructor(message: string, stderr = '') {
    super(stderr.trim() ? `${message}: ${stderr.trim()}` : message)
    this.name = 'GitShadowSnapshotError'
    this.stderr = stderr
  }
}

/**
 * 建仓配置。
 *
 * `core.autocrlf=false` 与 `core.longpaths=true` 在 Windows 上是硬要求：
 * 前者防止回滚顺手改写换行符，后者避免深层路径直接失败。
 * `gc.auto=0` 让 capture 的耗时可预测，对象回收改由显式治理触发。
 */
const SHADOW_REPO_CONFIG: ReadonlyArray<readonly [string, string]> = [
  ['core.autocrlf', 'false'],
  ['core.longpaths', 'true'],
  ['core.symlinks', 'true'],
  ['core.quotepath', 'false'],
  ['core.fsmonitor', 'false'],
  ['core.untrackedCache', 'true'],
  ['feature.manyFiles', 'true'],
  ['index.version', '4'],
  ['index.threads', 'true'],
  ['gc.auto', '0']
]

/**
 * 用一个藏在应用数据目录里的 Git 仓库给工作台拍快照。
 *
 * 仓库的 GIT_DIR 与工作树是分离的：用户文件夹里不会出现 `.git`，
 * 也不会产生任何提交，快照只是「更新索引 + write-tree」得到的一个树对象。
 */
export function createGitShadowSnapshotStore(
  options: GitShadowSnapshotStoreOptions
): WorkspaceSnapshotStore {
  const fs = options.fs ?? createNodeGitShadowFs()
  const mutex = options.mutex ?? createKeyedMutex()
  const maxUntrackedFileBytes = options.maxUntrackedFileBytes ?? DEFAULT_MAX_UNTRACKED_FILE_BYTES
  const commandTimeoutMs = options.commandTimeoutMs

  async function git(
    folderRoot: string,
    gitDir: string,
    args: string[],
    input: { stdin?: string } = {}
  ): Promise<WorkspaceGitCommandResult> {
    return options.runGit({
      args: ['--git-dir', gitDir, '--work-tree', folderRoot, ...args],
      cwd: folderRoot,
      stdin: input.stdin,
      timeoutMs: commandTimeoutMs
    })
  }

  async function gitOrThrow(
    folderRoot: string,
    gitDir: string,
    args: string[],
    input: { stdin?: string } = {}
  ): Promise<string> {
    const result = await git(folderRoot, gitDir, args, input)
    if (result.code !== 0 || result.timedOut) {
      throw new GitShadowSnapshotError(
        `git ${args[0]} failed${result.timedOut ? ' (timed out)' : ''}`,
        result.stderr
      )
    }
    return result.stdout
  }

  async function seedFromSourceRepository(folderRoot: string, gitDir: string): Promise<void> {
    const sourceGitDir = join(folderRoot, '.git')
    const sourceObjects = join(sourceGitDir, 'objects')
    // `.git` 也可能是指向别处的文件（worktree / submodule），那种情况直接跳过
    if (!(await fs.exists(sourceObjects))) return

    try {
      await fs.writeFile(join(gitDir, 'objects', 'info', 'alternates'), `${sourceObjects}\n`)
      // 复制索引可以复用已有的哈希与 stat 缓存，首次 capture 会快很多
      await fs.copyFile(join(sourceGitDir, 'index'), join(gitDir, 'index'))
    } catch (error) {
      options.onWarn?.('shadow snapshot: seed from source repository failed', { error })
    }
  }

  async function ensureRepository(folderRoot: string): Promise<string> {
    const gitDir = options.resolveGitDir(folderRoot)
    const initialized = await fs.exists(join(gitDir, 'HEAD'))

    if (!initialized) {
      await fs.ensureDir(gitDir)
      await gitOrThrow(folderRoot, gitDir, ['init'])
      for (const [key, value] of SHADOW_REPO_CONFIG) {
        await gitOrThrow(folderRoot, gitDir, ['config', key, value])
      }
    }

    // 每次都重写，规则升级后无需迁移；用户工作区自己的 .gitignore 由 --exclude-standard 一并生效
    await fs.writeFile(join(gitDir, 'info', 'exclude'), buildSnapshotExcludeFile())

    if (!initialized) {
      await seedFromSourceRepository(folderRoot, gitDir)
    }

    return gitDir
  }

  async function refreshIndex(
    folderRoot: string,
    gitDir: string
  ): Promise<{ oversized: string[] }> {
    const changed = splitNulSeparated(
      await gitOrThrow(folderRoot, gitDir, ['diff-files', '--name-only', '-z'])
    )
    const untracked = splitNulSeparated(
      await gitOrThrow(folderRoot, gitDir, ['ls-files', '--others', '--exclude-standard', '-z'])
    )

    const maxFileCount = options.maxSnapshotFileCount
    if (maxFileCount != null && changed.length + untracked.length > maxFileCount) {
      throw new GitShadowSnapshotError(
        `shadow snapshot: workspace has too many files to snapshot (${changed.length + untracked.length} > ${maxFileCount})`
      )
    }

    const { allowed, oversized } = await filterOversizedPaths({
      paths: untracked,
      maxBytes: maxUntrackedFileBytes,
      fileSize: (relativePath) => fs.fileSize(resolveWorkspacePath(folderRoot, relativePath))
    })

    if (oversized.length > 0) {
      options.onWarn?.('shadow snapshot: skipped oversized files', {
        count: oversized.length,
        maxUntrackedFileBytes
      })
      await git(
        folderRoot,
        gitDir,
        ['rm', '--cached', '-f', '--ignore-unmatch', '--pathspec-from-file=-', '--pathspec-file-nul'],
        { stdin: joinNulSeparated(oversized) }
      )
    }

    const staged = [...changed, ...allowed]
    if (staged.length > 0) {
      await gitOrThrow(
        folderRoot,
        gitDir,
        ['add', '--all', '--sparse', '--pathspec-from-file=-', '--pathspec-file-nul'],
        { stdin: joinNulSeparated(staged) }
      )
    }

    return { oversized }
  }

  /**
   * 判断哪些路径压根不在快照的覆盖范围内。
   *
   * 「不在 tree 里」有两种截然不同的含义：一种是这一轮才新建的文件，回滚就该删掉；
   * 另一种是被忽略规则或体积上限挡在快照之外的文件，它的旧内容我们从来没存过，
   * 删掉就是永久丢数据。这里把后者挑出来，宁可留下一个本轮新建的大文件，
   * 也不能误删用户原有的文件。
   */
  async function findPathsOutsideSnapshotScope(
    folderRoot: string,
    gitDir: string,
    paths: string[],
    excludedAtCapture: readonly string[] = []
  ): Promise<Set<string>> {
    const outside = new Set(excludedAtCapture)
    const remaining = paths.filter((path) => !outside.has(path))
    if (remaining.length === 0) return outside

    // 忽略规则不随文件内容变化，回滚时现查依然可信
    const ignoreCheck = await git(folderRoot, gitDir, ['check-ignore', '-z', '--stdin'], {
      stdin: joinNulSeparated(remaining)
    })
    // 退出码 0 表示确有路径命中忽略规则，1 表示一个都没命中
    if (ignoreCheck.code === 0) {
      for (const path of splitNulSeparated(ignoreCheck.stdout)) outside.add(path)
    }

    return outside
  }

  async function listPathsPresentInTree(
    folderRoot: string,
    gitDir: string,
    treeOid: string,
    paths: string[]
  ): Promise<Set<string>> {
    const present = new Set<string>()
    for (const chunk of chunkPathspecs(paths)) {
      const output = await gitOrThrow(folderRoot, gitDir, [
        'ls-tree',
        '-r',
        '-z',
        '--name-only',
        '--full-name',
        treeOid,
        '--',
        ...chunk
      ])
      for (const path of splitNulSeparated(output)) present.add(path)
    }
    return present
  }

  return {
    kind: 'git',

    async capture({ folderRoot }) {
      const gitDir = options.resolveGitDir(folderRoot)
      return mutex.run(gitDir, async () => {
        await ensureRepository(folderRoot)
        const { oversized } = await refreshIndex(folderRoot, gitDir)
        const treeOid = (await gitOrThrow(folderRoot, gitDir, ['write-tree'])).trim()
        if (!treeOid) {
          throw new GitShadowSnapshotError('shadow snapshot: write-tree returned no object id')
        }

        // 挂引用失败不影响本次回滚，只是这棵树会在下一次 gc 时被当成垃圾
        const anchored = await git(folderRoot, gitDir, [
          'update-ref',
          snapshotRefName(treeOid),
          treeOid
        ])
        if (anchored.code !== 0) {
          options.onWarn?.('shadow snapshot: failed to anchor snapshot tree', {
            treeOid,
            stderr: anchored.stderr.trim()
          })
        }

        return oversized.length > 0
          ? { kind: 'git', treeOid, excludedPaths: oversized }
          : { kind: 'git', treeOid }
      })
    },

    async extend({ handle }) {
      // 整棵工作树已在 tree 里，无需按路径补录
      return handle
    },

    listPaths() {
      // tree 覆盖整个工作区，列举它等于把用户所有文件纳入回滚范围
      return null
    },

    async restore({ folderRoot, handle, paths }) {
      if (!isGitSnapshotHandle(handle)) return emptyRestoreResult()

      const wanted = [...new Set(paths.map(normalizeWorkspaceRelativePath))].filter(Boolean)
      if (wanted.length === 0) return emptyRestoreResult()

      const gitDir = options.resolveGitDir(folderRoot)
      return mutex.run(gitDir, async () => {
        await ensureRepository(folderRoot)
        const result = emptyRestoreResult()
        const present = await listPathsPresentInTree(folderRoot, gitDir, handle.treeOid, wanted)

        for (const chunk of chunkPathspecs([...present])) {
          await gitOrThrow(folderRoot, gitDir, ['checkout', handle.treeOid, '--', ...chunk])
          result.restored.push(...chunk)
        }

        const absent = wanted.filter((path) => !present.has(path))
        const outOfScope = await findPathsOutsideSnapshotScope(
          folderRoot,
          gitDir,
          absent,
          handle.excludedPaths
        )
        const removed: string[] = []
        for (const path of absent) {
          if (outOfScope.has(path)) {
            result.skipped.push(path)
            continue
          }

          const absolutePath = resolveWorkspacePath(folderRoot, path)
          if (await fs.exists(absolutePath)) {
            await fs.removePath(absolutePath)
            result.deleted.push(path)
            removed.push(path)
          } else {
            result.skipped.push(path)
          }
        }

        if (outOfScope.size > 0) {
          options.onWarn?.('shadow snapshot: paths outside snapshot scope were left untouched', {
            count: outOfScope.size
          })
        }

        // 让索引跟上磁盘，否则下一次 capture 会把这些删除当成新变更
        if (removed.length > 0) {
          await git(
            folderRoot,
            gitDir,
            [
              'rm',
              '--cached',
              '-f',
              '--ignore-unmatch',
              '--pathspec-from-file=-',
              '--pathspec-file-nul'
            ],
            { stdin: joinNulSeparated(removed) }
          )
        }

        return result
      })
    },

    async diffPaths({ folderRoot, from, to }) {
      if (!isGitSnapshotHandle(from) || !isGitSnapshotHandle(to)) return null
      if (from.treeOid === to.treeOid) return []

      const gitDir = options.resolveGitDir(folderRoot)
      return mutex.run(gitDir, async () => {
        await ensureRepository(folderRoot)
        const output = await gitOrThrow(folderRoot, gitDir, [
          'diff',
          '--name-only',
          '-z',
          from.treeOid,
          to.treeOid
        ])
        return splitNulSeparated(output)
      })
    }
  }
}
