import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

/** tesseract.js 官方 Node worker 相对其 package 根目录的路径 */
export const TESSERACT_NODE_WORKER_SEGMENTS = ['src', 'worker-script', 'node', 'index.js'] as const

export function buildTesseractNodeWorkerPath(packageRoot: string): string {
  return path.join(packageRoot, ...TESSERACT_NODE_WORKER_SEGMENTS)
}

export function isUsableTesseractNodeWorkerPath(
  workerPath: string | null | undefined
): workerPath is string {
  return typeof workerPath === 'string' && workerPath.length > 0 && existsSync(workerPath)
}

/**
 * 从真实 node_modules 解析 worker 入口。
 * Vite 把 tesseract.js 打进 out/main 后，包内默认 `__dirname/../../worker-script`
 * 会落到 `apps/desktop/worker-script`，工作线程加载失败并变成主进程未捕获异常。
 */
export function resolveTesseractNodeWorkerPath(requireFrom: string = import.meta.url): string | null {
  try {
    const req = createRequire(requireFrom)
    const packageRoot = path.dirname(req.resolve('tesseract.js/package.json'))
    const workerPath = buildTesseractNodeWorkerPath(packageRoot)
    return isUsableTesseractNodeWorkerPath(workerPath) ? workerPath : null
  } catch {
    return null
  }
}

export function tesseractCreateWorkerOptions(
  workerPath: string | null | undefined
): { workerPath: string } | undefined {
  if (!isUsableTesseractNodeWorkerPath(workerPath)) return undefined
  return { workerPath }
}
