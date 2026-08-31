import type { WorkspaceRollbackScope } from '@baishou/shared'

export const SKIP_EDIT_RESEND_CONFIRM_KEY = 'baishou:workbench-skip-edit-resend-confirm'

export function readSkipEditResendConfirm(): WorkspaceRollbackScope | null {
  try {
    const raw = localStorage.getItem(SKIP_EDIT_RESEND_CONFIRM_KEY)
    if (raw === 'all' || raw === 'attributed') return raw
    if (raw === '1') return 'attributed'
    return null
  } catch {
    return null
  }
}

export function writeSkipEditResendConfirm(scope: WorkspaceRollbackScope): void {
  try {
    localStorage.setItem(SKIP_EDIT_RESEND_CONFIRM_KEY, scope)
  } catch {
    // ignore quota / private mode
  }
}
