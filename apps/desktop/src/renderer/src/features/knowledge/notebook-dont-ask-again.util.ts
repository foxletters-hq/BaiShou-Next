export const NOTEBOOK_SKIP_OPEN_GUIDE_PREFIX = 'baishou:notebook-skip-open-guide:'
export const NOTEBOOK_SESSION_DISMISS_OPEN_GUIDE_PREFIX =
  'baishou:notebook-session-dismiss-open-guide:'

export function notebookSkipOpenGuideKey(notebookId: string): string {
  return `${NOTEBOOK_SKIP_OPEN_GUIDE_PREFIX}${notebookId}`
}

export function notebookSessionDismissOpenGuideKey(notebookId: string): string {
  return `${NOTEBOOK_SESSION_DISMISS_OPEN_GUIDE_PREFIX}${notebookId}`
}

function listStorageKeys(storage: Storage, prefix: string): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
  } catch {
    /* ignore quota / private mode */
  }
  return keys
}

function listSkipKeys(): string[] {
  try {
    return listStorageKeys(localStorage, NOTEBOOK_SKIP_OPEN_GUIDE_PREFIX)
  } catch {
    return []
  }
}

export function readSkipNotebookOpenGuide(notebookId: string): boolean {
  const id = notebookId.trim()
  if (!id) return false
  try {
    return localStorage.getItem(notebookSkipOpenGuideKey(id)) === '1'
  } catch {
    return false
  }
}

export function writeSkipNotebookOpenGuide(notebookId: string): void {
  const id = notebookId.trim()
  if (!id) return
  try {
    localStorage.setItem(notebookSkipOpenGuideKey(id), '1')
  } catch {
    /* ignore */
  }
}

export function readSessionDismissNotebookOpenGuide(notebookId: string): boolean {
  const id = notebookId.trim()
  if (!id) return false
  try {
    return sessionStorage.getItem(notebookSessionDismissOpenGuideKey(id)) === '1'
  } catch {
    return false
  }
}

export function writeSessionDismissNotebookOpenGuide(notebookId: string): void {
  const id = notebookId.trim()
  if (!id) return
  try {
    sessionStorage.setItem(notebookSessionDismissOpenGuideKey(id), '1')
  } catch {
    /* ignore */
  }
}

export function shouldShowNotebookOpenGuide(notebookId: string): boolean {
  const id = notebookId.trim()
  if (!id) return false
  return !readSkipNotebookOpenGuide(id) && !readSessionDismissNotebookOpenGuide(id)
}

export function dismissNotebookOpenGuide(
  notebookId: string,
  dontAskAgain: boolean
): void {
  writeSessionDismissNotebookOpenGuide(notebookId)
  if (dontAskAgain) writeSkipNotebookOpenGuide(notebookId)
}

export function hasAnyNotebookDontAskAgain(): boolean {
  try {
    return (
      listSkipKeys().length > 0 ||
      listStorageKeys(sessionStorage, NOTEBOOK_SESSION_DISMISS_OPEN_GUIDE_PREFIX).length > 0
    )
  } catch {
    return listSkipKeys().length > 0
  }
}

/** 清空全部笔记本「不再提示」和本次已关闭的引导，返回实际删除的键数量。 */
export function clearAllNotebookDontAskAgain(): number {
  let cleared = 0
  for (const key of listSkipKeys()) {
    try {
      localStorage.removeItem(key)
      cleared += 1
    } catch {
      /* ignore */
    }
  }
  try {
    for (const key of listStorageKeys(sessionStorage, NOTEBOOK_SESSION_DISMISS_OPEN_GUIDE_PREFIX)) {
      sessionStorage.removeItem(key)
      cleared += 1
    }
  } catch {
    /* ignore */
  }
  return cleared
}
