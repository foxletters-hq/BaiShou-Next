// @ts-ignore - Node built-in, available at runtime
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_BYTES = 50_000
const MAX_OUTPUT_LINES = 2_000

export interface RunHostProcessParams {
  command: string
  cwd: string
  timeoutMs?: number
  abortSignal?: AbortSignal
}

export interface RunHostProcessResult {
  exitCode: number | null
  timedOut: boolean
  truncated: boolean
  output: string
}

function resolveShell(): string | boolean {
  if (process.platform === 'win32') {
    return process.env.ComSpec || process.env.COMSPEC || 'cmd.exe'
  }
  return '/bin/sh'
}

function killProcessTree(child: ChildProcessWithoutNullStreams): void {
  const pid = child.pid
  if (pid == null) return

  if (process.platform === 'win32') {
    spawn('taskkill', ['/t', '/f', '/pid', String(pid)], {
      stdio: 'ignore',
      windowsHide: true
    }).on('error', () => {
      try {
        child.kill()
      } catch {
        // ignore
      }
    })
    return
  }

  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      // ignore
    }
  }
}

function applyOutputLimits(raw: string): { output: string; truncated: boolean } {
  let truncated = false
  let output = raw

  const lines = output.split('\n')
  if (lines.length > MAX_OUTPUT_LINES) {
    output = lines.slice(0, MAX_OUTPUT_LINES).join('\n')
    truncated = true
  }

  if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) {
    output = Buffer.from(output, 'utf8').subarray(0, MAX_OUTPUT_BYTES).toString('utf8')
    truncated = true
  }

  return { output, truncated }
}

/**
 * Run a host command in `cwd` with merged stdout/stderr, timeout, and abort support.
 * No OS sandbox — callers must gate via BaishouAgentGate / workspace session checks.
 */
export function runHostProcess(params: RunHostProcessParams): Promise<RunHostProcessResult> {
  const timeoutMs =
    typeof params.timeoutMs === 'number' && Number.isFinite(params.timeoutMs)
      ? Math.max(1, params.timeoutMs)
      : DEFAULT_TIMEOUT_MS

  return new Promise((resolvePromise) => {
    if (params.abortSignal?.aborted) {
      resolvePromise({
        exitCode: null,
        timedOut: false,
        truncated: false,
        output: 'Error: aborted before start'
      })
      return
    }

    const shell = resolveShell()
    const child = spawn(params.command, {
      cwd: params.cwd,
      shell,
      windowsHide: true,
      // New process group on Unix so timeout can kill the whole tree via -pid.
      detached: process.platform !== 'win32'
    }) as ChildProcessWithoutNullStreams

    let raw = ''
    let timedOut = false
    let settled = false
    let collecting = true

    const finish = (exitCode: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      params.abortSignal?.removeEventListener('abort', onAbort)
      const { output, truncated } = applyOutputLimits(raw)
      resolvePromise({
        exitCode,
        timedOut,
        truncated,
        output
      })
    }

    const onAbort = () => {
      timedOut = false
      killProcessTree(child)
      finish(null)
    }

    params.abortSignal?.addEventListener('abort', onAbort, { once: true })

    const timer = setTimeout(() => {
      timedOut = true
      killProcessTree(child)
    }, timeoutMs)

    const onChunk = (chunk: string) => {
      if (!collecting) return
      raw += chunk
      if (
        Buffer.byteLength(raw, 'utf8') > MAX_OUTPUT_BYTES * 2 ||
        raw.split('\n').length > MAX_OUTPUT_LINES + 50
      ) {
        // Soft-stop collecting oversized streams; final limits applied in finish().
        collecting = false
      }
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)

    child.on('error', (error) => {
      raw = raw ? `${raw}\nError: ${error.message}` : `Error: ${error.message}`
      finish(null)
    })

    child.on('close', (code) => {
      finish(timedOut ? null : code)
    })
  })
}
