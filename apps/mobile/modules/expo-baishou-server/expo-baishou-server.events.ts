import { getNative, requireNative } from './expo-baishou-server.native'

/**
 * 原生事件订阅。缺模块时多数监听返回空 remove，避免调用方先判 available 再订阅。
 * 归档进度除外：解压必须有原生实现，订阅失败应立刻抛，而不是 silently 丢进度。
 */
export function onFileReceived(listener: (event: { path: string }) => void) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onFileReceived', listener)
}

export function onLanUploadStarted(listener: (event: { totalBytes: number }) => void) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onLanUploadStarted', listener)
}

export function onLanUploadProgress(
  listener: (event: { writtenBytes: number; totalBytes: number }) => void
) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onLanUploadProgress', listener)
}

export function onStorageRootCopyProgress(listener: (event: { itemName: string }) => void) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onStorageRootCopyProgress', listener)
}

export function onMcpHttpRequest(
  listener: (event: {
    requestId: string
    method: string
    path?: string
    headers: Record<string, string>
    body: string
  }) => void
) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onMcpHttpRequest', listener)
}

export function onSyncHttpTransferProgress(
  listener: (event: { filePath: string; writtenBytes: number; totalBytes: number }) => void
) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onSyncHttpTransferProgress', listener)
}

export function onArchiveImportProgress(
  listener: (event: { phase: string; current: number; total: number; detail: string }) => void
) {
  const mod = requireNative()
  return mod.addListener('onArchiveImportProgress', listener)
}
