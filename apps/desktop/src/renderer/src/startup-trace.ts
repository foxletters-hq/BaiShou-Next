type StartupDetail = Record<string, unknown>

type StartupBridge = {
  marks: Array<{ step: string; navMs: number; detail?: StartupDetail }>
}

declare global {
  interface Window {
    __BAISHOU_STARTUP__?: StartupBridge
  }
}

function ensureBridge(): StartupBridge {
  if (!window.__BAISHOU_STARTUP__) {
    window.__BAISHOU_STARTUP__ = { marks: [] }
  }
  return window.__BAISHOU_STARTUP__
}

function sendToMain(step: string, navMs: number, detail?: StartupDetail): void {
  try {
    const electron = (window as any).electron
    electron?.ipcRenderer?.send?.('startup:mark', {
      step: `renderer.${step}`,
      navMs,
      detail
    })
  } catch {
    // preload / bridge 尚未就绪时忽略
  }
}

/** 渲染进程冷启动打点：nav+ 相对本次导航开始；并转发到主进程终端 */
export function markRendererStartup(step: string, detail?: StartupDetail): void {
  const navMs = Math.round(performance.now())
  const bridge = ensureBridge()
  bridge.marks.push({ step, navMs, detail })
  console.info(`[Startup][renderer] ● ${step} (nav+${navMs}ms)`, detail ?? {})
  sendToMain(step, navMs, detail)
}

/** 把 index.html inline 里积压的标记补发到主进程（仅 html.*，避免与后续打点重复） */
export function flushPendingRendererStartupMarks(): void {
  const pending = ensureBridge().marks.filter((mark) => mark.step.startsWith('html.'))
  for (const mark of pending) {
    sendToMain(mark.step, mark.navMs, mark.detail)
  }
}

export async function traceRendererStep<T>(
  step: string,
  work: () => Promise<T> | T,
  detail?: StartupDetail
): Promise<T> {
  const started = performance.now()
  markRendererStartup(`${step}.begin`, detail)
  try {
    const result = await work()
    markRendererStartup(`${step}.done`, {
      ...detail,
      ms: Math.round(performance.now() - started)
    })
    return result
  } catch (error) {
    markRendererStartup(`${step}.failed`, {
      ...detail,
      ms: Math.round(performance.now() - started)
    })
    throw error
  }
}
