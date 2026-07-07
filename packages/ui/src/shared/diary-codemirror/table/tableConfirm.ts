import i18n from 'i18next'
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

const pendingConfirms = new Map<string, (confirmed: boolean) => void>()

export function resolveTableConfirmResponse(requestId: string, confirmed: boolean): void {
  const resolve = pendingConfirms.get(requestId)
  if (!resolve) return
  pendingConfirms.delete(requestId)
  resolve(confirmed)
}

export function confirmMessageForDestructiveItem(item: { id: string; label: string }): string {
  if (item.id === 'delete-table')
    return i18n.t(
      'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L17',
      '确定要删除这张表格吗？此操作不可撤销。'
    )
  if (
    item.id === 'delete' &&
    item.label.includes(
      i18n.t('auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L18', '列')
    )
  ) {
    return i18n.t(
      'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L19',
      '确定要删除这一列吗？此操作不可撤销。'
    )
  }
  if (
    item.id === 'delete' &&
    item.label.includes(
      i18n.t('auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L21', '行')
    )
  ) {
    return i18n.t(
      'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L22',
      '确定要删除这一行吗？此操作不可撤销。'
    )
  }
  return `确定要${item.label}吗？`
}

/** RN WebView 内 window.confirm 不可靠，走原生 Alert */
export function requestTableConfirm(
  message: string,
  options?: { title?: string; confirmText?: string; destructive?: boolean }
): Promise<boolean> {
  const rn = window.ReactNativeWebView
  if (rn) {
    return new Promise((resolve) => {
      const requestId = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const timer = window.setTimeout(() => {
        if (pendingConfirms.delete(requestId)) resolve(false)
      }, 60_000)
      pendingConfirms.set(requestId, (confirmed) => {
        clearTimeout(timer)
        resolve(confirmed)
      })
      try {
        rn.postMessage(
          JSON.stringify({
            type: 'confirmRequest',
            payload: {
              requestId,
              title:
                options?.title ??
                i18n.t(
                  'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L49',
                  '确认'
                ),
              message,
              confirmText:
                options?.confirmText ??
                i18n.t(
                  'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L51',
                  '删除'
                ),
              cancelText: i18n.t(
                'auto.packages.ui.src.shared.diary.codemirror.table.tableConfirm.L52',
                '取消'
              ),
              destructive: options?.destructive ?? true
            }
          })
        )
      } catch {
        clearTimeout(timer)
        pendingConfirms.delete(requestId)
        resolve(false)
      }
    })
  }
  return Promise.resolve(window.confirm(message))
}
