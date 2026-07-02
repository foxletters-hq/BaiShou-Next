import { logDiaryBridge } from '../diaryBridgeDebug'

type TableChromeDebugDetail = Record<string, unknown>

declare global {
  interface Window {
    __tableChromeDebug?: boolean
  }
}

/** 表格把手 / 菜单调试：console + 转发到 RN Bridge（Metro 可见 [DiaryEditor Bridge] tableChrome: ...） */
export function logTableChrome(tag: string, detail?: TableChromeDebugDetail): void {
  logDiaryBridge('tableChrome', tag, detail)
}
