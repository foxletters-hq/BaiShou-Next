import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pruneShadowSnapshotObjects } from '../git-shadow-gc'
import {
  createGitShadowSnapshotStore,
  type WorkspaceGitCommandResult,
  type WorkspaceGitRunner
} from '../git-shadow-snapshot.store'
import type { WorkspaceSnapshotHandle, WorkspaceSnapshotStore } from '../workspace-snapshot-store'

const gitAvailable = (() => {
  try {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0
  } catch {
    return false
  }
})()

/** 集成测试直接驱动系统 git；桌面运行时换成随包分发的内置 git，命令完全一致 */
const runSystemGit: WorkspaceGitRunner = ({ args, cwd, stdin }) =>
  new Promise<WorkspaceGitCommandResult>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LC_ALL: 'C' }
    })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut: false
      })
    )

    child.stdin.on('error', () => {})
    if (stdin != null) child.stdin.write(stdin)
    child.stdin.end()
  })

describe.skipIf(!gitAvailable)('git shadow snapshot against a real repository', () => {
  let tmpRoot: string
  let workspace: string
  let store: WorkspaceSnapshotStore

  const abs = (relativePath: string) => join(workspace, relativePath)

  async function write(relativePath: string, content: string | Buffer): Promise<void> {
    const target = abs(relativePath)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, content)
  }

  async function capture(): Promise<WorkspaceSnapshotHandle> {
    return store.capture({ folderRoot: workspace })
  }

  async function restore(handle: WorkspaceSnapshotHandle, paths: string[]) {
    return store.restore({ folderRoot: workspace, handle, paths })
  }

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'baishou-shadow-'))
    workspace = join(tmpRoot, 'workspace')
    await mkdir(workspace, { recursive: true })

    store = createGitShadowSnapshotStore({
      runGit: runSystemGit,
      // 影子仓库必须留在工作树之外，否则它会把自己也当成待快照的内容
      resolveGitDir: () => join(tmpRoot, 'shadow.git')
    })
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true, maxRetries: 3 })
  })

  it('leaves no git metadata inside the user folder', async () => {
    await write('note.md', 'hello')
    await capture()

    expect(existsSync(join(workspace, '.git'))).toBe(false)
    expect(existsSync(join(tmpRoot, 'shadow.git', 'HEAD'))).toBe(true)
  })

  it('restores an edited file to its pre-round content', async () => {
    await write('note.md', 'original')
    const before = await capture()

    await write('note.md', 'rewritten by agent')
    const result = await restore(before, ['note.md'])

    expect(result.restored).toEqual(['note.md'])
    await expect(readFile(abs('note.md'), 'utf8')).resolves.toBe('original')
  })

  it('deletes a file that did not exist before the round', async () => {
    const before = await capture()

    await write('created.md', 'brand new')
    const result = await restore(before, ['created.md'])

    expect(result.deleted).toEqual(['created.md'])
    expect(existsSync(abs('created.md'))).toBe(false)
  })

  it('brings back a file the agent deleted', async () => {
    await write('doomed.md', 'still needed')
    const before = await capture()

    await rm(abs('doomed.md'))
    const result = await restore(before, ['doomed.md'])

    expect(result.restored).toEqual(['doomed.md'])
    await expect(readFile(abs('doomed.md'), 'utf8')).resolves.toBe('still needed')
  })

  it('undoes a rename when both sides are restored', async () => {
    await write('old-name.md', 'content')
    const before = await capture()

    await rm(abs('old-name.md'))
    await write('new-name.md', 'content')
    const result = await restore(before, ['old-name.md', 'new-name.md'])

    expect(result.restored).toEqual(['old-name.md'])
    expect(result.deleted).toEqual(['new-name.md'])
    await expect(readFile(abs('old-name.md'), 'utf8')).resolves.toBe('content')
    expect(existsSync(abs('new-name.md'))).toBe(false)
  })

  it('round-trips binary content byte for byte', async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0xff, 0xfe, 0x00, 0x80
    ])
    await write('assets/logo.png', png)
    const before = await capture()

    await write('assets/logo.png', Buffer.from([0x00, 0x01, 0x02]))
    await restore(before, ['assets/logo.png'])

    const restored = await readFile(abs('assets/logo.png'))
    expect(restored.equals(png)).toBe(true)
  })

  it('preserves CRLF line endings instead of normalizing them', async () => {
    await write('windows.md', 'line one\r\nline two\r\n')
    const before = await capture()

    await write('windows.md', 'clobbered')
    await restore(before, ['windows.md'])

    const restored = await readFile(abs('windows.md'))
    expect(restored.toString('utf8')).toBe('line one\r\nline two\r\n')
  })

  it('handles non-ascii paths and spaces', async () => {
    const relativePath = '笔记 目录/中文 文件.md'
    await write(relativePath, '原始内容')
    const before = await capture()

    await write(relativePath, '被改写了')
    const result = await restore(before, [relativePath])

    expect(result.restored).toEqual([relativePath])
    await expect(readFile(abs(relativePath), 'utf8')).resolves.toBe('原始内容')
  })

  it('handles deeply nested directories', async () => {
    const relativePath = `${Array.from({ length: 12 }, (_, i) => `level-${i}`).join('/')}/deep.md`
    await write(relativePath, 'deep original')
    const before = await capture()

    await write(relativePath, 'deep changed')
    await restore(before, [relativePath])

    await expect(readFile(abs(relativePath), 'utf8')).resolves.toBe('deep original')
  })

  it('detects changes no tool reported, which is how terminal edits get caught', async () => {
    await write('tracked.md', 'v1')
    const before = await capture()

    await write('tracked.md', 'v2 written by a shell command')
    await write('side-effect.log', 'created by a shell command')
    const after = await capture()

    const changed = await store.diffPaths({ folderRoot: workspace, from: before, to: after })
    expect(changed).toEqual(expect.arrayContaining(['tracked.md', 'side-effect.log']))

    await restore(before, changed ?? [])
    await expect(readFile(abs('tracked.md'), 'utf8')).resolves.toBe('v1')
    expect(existsSync(abs('side-effect.log'))).toBe(false)
  })

  it('respects the workspace .gitignore and the built-in exclude rules', async () => {
    await write('.gitignore', 'ignored/\n')
    await write('ignored/secret.md', 'should stay out')
    await write('node_modules/pkg/index.js', 'vendor')
    await write('~$draft.docx', 'office lock file')
    await write('kept.md', 'in snapshot')

    const before = await capture()
    await rm(abs('kept.md'))
    await rm(abs('ignored/secret.md'))

    const result = await restore(before, ['kept.md', 'ignored/secret.md'])

    expect(result.restored).toEqual(['kept.md'])
    // 被排除的路径不在快照里，因此既不会被恢复，也不会被误删
    expect(result.skipped).toEqual(['ignored/secret.md'])
    expect(existsSync(abs('node_modules/pkg/index.js'))).toBe(true)
  })

  it('keeps oversized files out of the snapshot rather than bloating it', async () => {
    const small = createGitShadowSnapshotStore({
      runGit: runSystemGit,
      resolveGitDir: () => join(tmpRoot, 'shadow.git'),
      maxUntrackedFileBytes: 64
    })

    await write('big.bin', Buffer.alloc(512, 0x41))
    await write('small.md', 'tiny')
    const before = await small.capture({ folderRoot: workspace })

    await write('big.bin', Buffer.alloc(8, 0x42))
    const result = await small.restore({
      folderRoot: workspace,
      handle: before,
      paths: ['big.bin', 'small.md']
    })

    expect(result.skipped).toEqual(['big.bin'])
    await expect(readFile(abs('big.bin'))).resolves.toHaveLength(8)
  })

  it('refuses to snapshot a workspace with more files than the configured budget', async () => {
    const capped = createGitShadowSnapshotStore({
      runGit: runSystemGit,
      resolveGitDir: () => join(tmpRoot, 'shadow.git'),
      maxSnapshotFileCount: 2
    })

    await write('a.md', 'a')
    await write('b.md', 'b')
    await write('c.md', 'c')

    await expect(capped.capture({ folderRoot: workspace })).rejects.toThrow(/too many files/)
  })

  it('survives garbage collection as long as the checkpoint is alive', async () => {
    await write('doc.md', 'before the round')
    const before = await capture()

    await write('doc.md', 'after the round')
    await capture()

    const collected = await pruneShadowSnapshotObjects({
      runGit: runSystemGit,
      gitDir: join(tmpRoot, 'shadow.git'),
      folderRoot: workspace,
      liveTreeOids: before.kind === 'git' ? [before.treeOid] : []
    })
    expect(collected.collected).toBe(true)
    // 只有第一轮的检查点还在，第二轮那棵树应当被回收
    expect(collected.releasedRefs).toBe(1)

    await restore(before, ['doc.md'])
    await expect(readFile(abs('doc.md'), 'utf8')).resolves.toBe('before the round')
  })

  it('rolls back cascading rounds to the earliest snapshot', async () => {
    await write('doc.md', 'round 0')
    const round1 = await capture()

    await write('doc.md', 'round 1')
    await write('extra.md', 'added in round 2')
    const round2 = await capture()

    await write('doc.md', 'round 2')

    // 先撤后一轮，再撤前一轮，磁盘应收敛到第一轮之前
    await restore(round2, ['doc.md', 'extra.md'])
    await restore(round1, ['doc.md', 'extra.md'])

    await expect(readFile(abs('doc.md'), 'utf8')).resolves.toBe('round 0')
    expect(existsSync(abs('extra.md'))).toBe(false)
  })
})
