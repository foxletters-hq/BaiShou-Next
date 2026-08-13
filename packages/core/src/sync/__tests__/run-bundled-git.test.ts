import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureGitBinaryProvider } from '../git-binary.registry'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { BundledGitError, runBundledGit, runBundledGitOrThrow } from '../run-bundled-git'

class FakeChild extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn()
  }
  kill = vi.fn(() => {
    this.emit('close', null)
  })

  finish(code: number | null): void {
    this.emit('close', code)
  }
}

function nextChild(): FakeChild {
  const child = new FakeChild()
  spawnMock.mockImplementationOnce(() => child)
  return child
}

describe('runBundledGit', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    configureGitBinaryProvider({
      getBinary: () => '/bundled/git',
      getSpawnEnv: (extra = {}) => ({
        env: { PATH: '/usr/bin', ...extra },
        gitBinary: '/bundled/git'
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves stdout, stderr and exit code', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['status', '--porcelain'] })

    child.stdout.emit('data', Buffer.from('M file.md\n', 'utf8'))
    child.stderr.emit('data', Buffer.from('warning\n', 'utf8'))
    child.finish(0)

    await expect(promise).resolves.toEqual({
      code: 0,
      stdout: 'M file.md\n',
      stderr: 'warning\n',
      timedOut: false,
      outputTruncated: false
    })
  })

  it('decodes multi-byte paths split across chunk boundaries', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['ls-files', '-z'] })

    const payload = Buffer.from('笔记/中文路径.md', 'utf8')
    child.stdout.emit('data', payload.subarray(0, 5))
    child.stdout.emit('data', payload.subarray(5, 11))
    child.stdout.emit('data', payload.subarray(11))
    child.finish(0)

    const result = await promise
    expect(result.stdout).toBe('笔记/中文路径.md')
  })

  it('does not throw on non-zero exit', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['write-tree'] })

    child.stderr.emit('data', Buffer.from('fatal: not a git repository', 'utf8'))
    child.finish(128)

    const result = await promise
    expect(result.code).toBe(128)
    expect(result.stderr).toContain('not a git repository')
  })

  it('passes cwd and merges caller env over the bundled spawn env', async () => {
    const child = nextChild()
    const promise = runBundledGit({
      args: ['write-tree'],
      cwd: '/projects/notes',
      env: { GIT_INDEX_FILE: '/tmp/shadow.index' }
    })
    child.finish(0)
    await promise

    const [binary, args, options] = spawnMock.mock.calls[0]
    expect(binary).toBe('/bundled/git')
    expect(args).toEqual(['write-tree'])
    expect(options.cwd).toBe('/projects/notes')
    expect(options.windowsHide).toBe(true)
    expect(options.env).toMatchObject({
      PATH: '/usr/bin',
      LC_ALL: 'C.UTF-8',
      GIT_INDEX_FILE: '/tmp/shadow.index'
    })
  })

  it('writes stdin payload then closes the stream', async () => {
    const child = nextChild()
    const promise = runBundledGit({
      args: ['add', '--pathspec-from-file=-', '--pathspec-file-nul'],
      stdin: 'a.md\0b.md\0'
    })
    child.finish(0)
    await promise

    expect(child.stdin.write).toHaveBeenCalledWith('a.md\0b.md\0')
    expect(child.stdin.end).toHaveBeenCalled()
  })

  it('closes stdin without writing when no payload is given', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['status'] })
    child.finish(0)
    await promise

    expect(child.stdin.write).not.toHaveBeenCalled()
    expect(child.stdin.end).toHaveBeenCalled()
  })

  it('kills the process and flags timedOut when the timeout elapses', async () => {
    vi.useFakeTimers()
    const child = nextChild()
    const promise = runBundledGit({ args: ['fsck'], timeoutMs: 1000 })

    await vi.advanceTimersByTimeAsync(1000)
    expect(child.kill).toHaveBeenCalled()

    const result = await promise
    expect(result.timedOut).toBe(true)
  })

  it('truncates and kills once output exceeds the byte budget', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['diff'], maxOutputBytes: 8 })

    child.stdout.emit('data', Buffer.alloc(4, 0x61))
    child.stdout.emit('data', Buffer.alloc(16, 0x62))
    child.finish(null)

    const result = await promise
    expect(result.outputTruncated).toBe(true)
    expect(child.kill).toHaveBeenCalled()
    expect(result.stdout).toBe('aaaa')
  })

  it('rejects when the binary cannot be spawned', async () => {
    const child = nextChild()
    const promise = runBundledGit({ args: ['status'] })

    child.emit('error', new Error('ENOENT'))

    await expect(promise).rejects.toThrow('ENOENT')
  })
})

describe('runBundledGitOrThrow', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    configureGitBinaryProvider({
      getBinary: () => '/bundled/git',
      getSpawnEnv: () => ({ env: {}, gitBinary: '/bundled/git' })
    })
  })

  it('returns stdout on success', async () => {
    const child = nextChild()
    const promise = runBundledGitOrThrow({ args: ['write-tree'] })

    child.stdout.emit('data', Buffer.from('4b825dc642cb6eb9a060e54bf8d69288fbee4904\n', 'utf8'))
    child.finish(0)

    await expect(promise).resolves.toContain('4b825dc642cb6eb9a060e54bf8d69288fbee4904')
  })

  it('throws BundledGitError carrying stderr and exit code', async () => {
    const child = nextChild()
    const promise = runBundledGitOrThrow({ args: ['checkout', 'deadbeef'] })

    child.stderr.emit('data', Buffer.from('fatal: reference is not a tree', 'utf8'))
    child.finish(128)

    await expect(promise).rejects.toBeInstanceOf(BundledGitError)
    await promise.catch((error: InstanceType<typeof BundledGitError>) => {
      expect(error.code).toBe(128)
      expect(error.stderr).toContain('reference is not a tree')
      expect(error.args).toEqual(['checkout', 'deadbeef'])
    })
  })
})
