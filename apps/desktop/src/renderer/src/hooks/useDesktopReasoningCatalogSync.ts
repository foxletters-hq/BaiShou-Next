import { useEffect } from 'react'
import { applyReasoningCatalogPayload, type ReasoningCatalogPayload } from '@baishou/shared'

function isCatalogPayload(value: unknown): value is ReasoningCatalogPayload {
  if (!value || typeof value !== 'object') return false
  const rec = value as ReasoningCatalogPayload
  return Boolean(rec.byModelId) && typeof rec.byModelId === 'object'
}

/** 把主进程启动拉到的思考目录写入渲染进程缓存 */
export function useDesktopReasoningCatalogSync(): void {
  useEffect(() => {
    const ipc = window.electron?.ipcRenderer
    if (!ipc) return

    const apply = (payload: unknown) => {
      if (isCatalogPayload(payload) && Object.keys(payload.byModelId).length > 0) {
        applyReasoningCatalogPayload(payload)
      }
    }

    void ipc
      .invoke('reasoning-catalog:get')
      .then(apply)
      .catch(() => undefined)
    const unsubscribe = ipc.on('reasoning-catalog:updated', (_event, payload) => apply(payload))
    return () => {
      unsubscribe?.()
    }
  }, [])
}
