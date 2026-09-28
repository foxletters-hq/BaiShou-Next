/**
 * 渲染进程仅转发 warn/error，避免 preload IPC 调试 console 刷屏。
 */
export function installRendererDiagnosticLogCapture(): void {
  const api = window.api?.diagnosticLog
  if (!api?.append) return

  let forwarding = false

  const wrap = (
    level: 'warn' | 'error',
    original: (...args: unknown[]) => void
  ): ((...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      original(...args)
      if (forwarding) return
      forwarding = true
      try {
        const message = args
          .map((arg) => {
            if (arg instanceof Error) {
              return arg.stack || `${arg.name}: ${arg.message}`
            }
            if (typeof arg === 'string') return arg
            try {
              return JSON.stringify(arg)
            } catch {
              return String(arg)
            }
          })
          .join(' ')
        if (message.trim()) {
          void api.append(level, message)
        }
      } finally {
        forwarding = false
      }
    }
  }

  console.warn = wrap('warn', console.warn.bind(console))
  console.error = wrap('error', console.error.bind(console))
}
