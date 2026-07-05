import { logDiaryBridge } from '../diaryBridgeDebug'

declare global {
  interface Window {
    /** 桌面端表格专项日志；默认 dev 开启，生产可设 false 关闭 */
    __diaryTableDesktopDebug?: boolean
  }
}

function isTableDesktopDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__diaryTableDesktopDebug === false) return false
  if (window.__diaryTableDesktopDebug === true) return true
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true
  return false
}

/** 桌面端表格交互日志。控制台执行 `window.__diaryTableDesktopDebug = true` 可强制开启。 */
export function logTableDesktop(tag: string, detail?: Record<string, unknown>): void {
  if (!isTableDesktopDebugEnabled()) return
  logDiaryBridge('tableDesktop', tag, detail)
}
