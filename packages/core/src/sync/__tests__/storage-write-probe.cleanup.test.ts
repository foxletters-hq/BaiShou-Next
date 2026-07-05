import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupStorageWriteProbeFiles } from '../storage-write-probe.cleanup'

describe('cleanupStorageWriteProbeFiles', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  async function makeTempRoot(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-write-probe-'))
    tempDirs.push(dir)
    return dir
  }

  it('removes probe files at storage root', async () => {
    const root = await makeTempRoot()
    await fs.writeFile(path.join(root, '.write_test_1782499969450_zzldj'), 'test')
    await fs.writeFile(path.join(root, 'keep-me.txt'), 'ok')

    const removed = await cleanupStorageWriteProbeFiles(root, 0)

    expect(removed).toBe(1)
    await expect(fs.access(path.join(root, '.write_test_1782499969450_zzldj'))).rejects.toThrow()
    expect(await fs.readFile(path.join(root, 'keep-me.txt'), 'utf8')).toBe('ok')
  })

  it('removes probe files one level below storage root when maxDepth is 1', async () => {
    const root = await makeTempRoot()
    const vaultDir = path.join(root, 'Personal')
    await fs.mkdir(vaultDir)
    await fs.writeFile(path.join(vaultDir, '.baishou_write_test'), 'ok')

    const removed = await cleanupStorageWriteProbeFiles(root, 1)

    expect(removed).toBe(1)
    await expect(fs.access(path.join(vaultDir, '.baishou_write_test'))).rejects.toThrow()
  })

  it('skips .git directory while scanning', async () => {
    const root = await makeTempRoot()
    const gitDir = path.join(root, '.git')
    await fs.mkdir(gitDir)
    await fs.writeFile(path.join(gitDir, '.write_test_legacy'), 'x')

    const removed = await cleanupStorageWriteProbeFiles(root, 1)

    expect(removed).toBe(0)
    expect(await fs.readFile(path.join(gitDir, '.write_test_legacy'), 'utf8')).toBe('x')
  })
})
