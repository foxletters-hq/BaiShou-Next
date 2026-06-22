/** 远端文件下载失败是否应视为「对象不存在」从而跳过（不计入 downloaded） */
export function isIncrementalSyncRemoteFileNotFoundError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    const message = String(error)
    return message.includes('404') || message.toLowerCase().includes('not found')
  }
  const err = error as { code?: string; statusCode?: number; message?: string }
  const message = err.message ?? ''
  return (
    err.code === 'NotFound' ||
    err.statusCode === 404 ||
    message.includes('Not Found') ||
    message.includes('404') ||
    message.toLowerCase().includes('not found')
  )
}
