/**
 * 薄入口：仅加载启动打点，再动态 import 真实应用。
 * html.inline → main.tsx.enter → app-bootstrap.imports-evaluated
 * 三段间隔可区分「等 HTML」「等 Vite 拉模块」「应用依赖求值」。
 */
import { flushPendingRendererStartupMarks, markRendererStartup } from './startup-trace'

markRendererStartup('main.tsx.enter')
flushPendingRendererStartupMarks()

const bootstrapStarted = performance.now()
void import('./app-bootstrap')
  .then(() => {
    markRendererStartup('main.tsx.dynamic-import-resolved', {
      ms: Math.round(performance.now() - bootstrapStarted)
    })
  })
  .catch((error) => {
    console.error('[renderer] app-bootstrap failed:', error)
    markRendererStartup('main.tsx.dynamic-import-failed', {
      ms: Math.round(performance.now() - bootstrapStarted),
      message: error instanceof Error ? error.message : String(error)
    })
  })
