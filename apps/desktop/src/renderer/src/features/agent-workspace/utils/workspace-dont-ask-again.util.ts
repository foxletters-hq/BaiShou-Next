import { SKIP_EDIT_RESEND_CONFIRM_KEY } from './workspace-edit-resend-skip.util'

export const SKIP_MOVE_CONFIRM_KEY = 'baishou:workbench-skip-move-confirm'
export const SKIP_REMOVE_RECENT_CONFIRM_KEY = 'baishou:workbench-skip-remove-recent-confirm'

/** 工作台内所有「不再提示」的 localStorage 键，恢复时按此列表清空。 */
export const WORKBENCH_DONT_ASK_AGAIN_KEYS = [
  SKIP_EDIT_RESEND_CONFIRM_KEY,
  SKIP_MOVE_CONFIRM_KEY,
  SKIP_REMOVE_RECENT_CONFIRM_KEY
] as const

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // ignore quota / private mode
  }
}

export function readSkipMoveConfirm(): boolean {
  return readFlag(SKIP_MOVE_CONFIRM_KEY)
}

export function writeSkipMoveConfirm(): void {
  writeFlag(SKIP_MOVE_CONFIRM_KEY)
}

export function readSkipRemoveRecentConfirm(): boolean {
  return readFlag(SKIP_REMOVE_RECENT_CONFIRM_KEY)
}

export function writeSkipRemoveRecentConfirm(): void {
  writeFlag(SKIP_REMOVE_RECENT_CONFIRM_KEY)
}

export function hasAnyWorkbenchDontAskAgain(): boolean {
  try {
    return WORKBENCH_DONT_ASK_AGAIN_KEYS.some((key) => localStorage.getItem(key) != null)
  } catch {
    return false
  }
}

/** 清空全部「不再提示」，返回实际删除的键数量。 */
export function clearAllWorkbenchDontAskAgain(): number {
  let cleared = 0
  for (const key of WORKBENCH_DONT_ASK_AGAIN_KEYS) {
    try {
      if (localStorage.getItem(key) == null) continue
      localStorage.removeItem(key)
      cleared += 1
    } catch {
      // ignore quota / private mode
    }
  }
  return cleared
}
