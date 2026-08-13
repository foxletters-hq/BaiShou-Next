import { spawn } from 'node:child_process'
import { getBundledGitSpawnEnv, type GitSpawnEnv } from './git-binary.registry'

const DEFAULT_TIMEOUT_MS = 30_000
/** 单次命令的输出上限，避免超大 diff 把主进程内存撑爆 */
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024 * 1024

export interface RunBundledGitOptions {
  args: string[]
  cwd?: string
  /** 并入内置 Git 的 spawn 环境，可用于 GIT_INDEX_FILE 等需要按次覆盖的变量 */
  env?: GitSpawnEnv
  stdin?: string | Buffer
  timeoutMs?: number
  maxOutputBytes?: number
}

export interface BundledGitResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  outputTruncated: boolean
}

export class BundledGitError extends Error {
  readonly args: string[]
  readonly code: number | null
  readonly stderr: string
  readonly timedOut: boolean

  constructor(result: BundledGitResult, args: string[]) {
    const reason = result.timedOut
      ? 'timed out'
      : result.stderr.trim() || `exited with code ${result.code}`
    super(`git ${args.join(' ')} ${reason}`)
    this.name = 'BundledGitError'
    this.args = args
    this.code = result.code
    this.stderr = result.stderr
    this.timedOut = result.timedOut
  }
}

/**
 * 执行一次内置 Git 命令。
 *
 * 与 GitSync 内部的 runGitWithStdin 不同：cwd/env 完全由调用方决定，
 * 因此可以驱动 GIT_DIR 与工作树分离的影子仓库。
 *
 * 输出按 Buffer 收集后一次性解码，避免多字节字符在 chunk 边界被截断成乱码。
 * 命令非 0 退出不会抛错，由调用方判断 code。
 */
export function runBundledGit(options: RunBundledGitOptions): Promise<BundledGitResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES
  const { env, gitBinary } = getBundledGitSpawnEnv({ LC_ALL: 'C.UTF-8', ...options.env })

  return new Promise<BundledGitResult>((resolve, reject) => {
    const child = spawn(gitBinary, options.args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      windowsHide: true
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let collectedBytes = 0
    let outputTruncated = false
    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      timedOut = true
      child.kill()
    }, timeoutMs)

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const collect = (target: Buffer[], chunk: Buffer) => {
      if (outputTruncated) return
      collectedBytes += chunk.byteLength
      if (collectedBytes > maxOutputBytes) {
        outputTruncated = true
        child.kill()
        return
      }
      target.push(chunk)
    }

    child.stdout.on('data', (chunk: Buffer) => collect(stdoutChunks, chunk))
    child.stderr.on('data', (chunk: Buffer) => collect(stderrChunks, chunk))

    child.on('error', (error: Error) => settle(() => reject(error)))

    child.on('close', (code: number | null) => {
      settle(() =>
        resolve({
          code,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          timedOut,
          outputTruncated
        })
      )
    })

    if (child.stdin) {
      // 进程可能在写入前就退出（例如参数非法），EPIPE 交给 close 事件收敛
      child.stdin.on('error', () => {})
      if (options.stdin != null) child.stdin.write(options.stdin)
      child.stdin.end()
    }
  })
}

/** 只在成功时返回 stdout，失败抛出携带 stderr 的 BundledGitError */
export async function runBundledGitOrThrow(options: RunBundledGitOptions): Promise<string> {
  const result = await runBundledGit(options)
  if (result.code !== 0 || result.timedOut) {
    throw new BundledGitError(result, options.args)
  }
  return result.stdout
}
