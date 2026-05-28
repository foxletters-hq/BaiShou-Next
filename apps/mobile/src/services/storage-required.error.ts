/** Android 未授予全文件访问、无法使用 BaiShou_Root 时抛出 */
export class ExternalStorageRequiredError extends Error {
  readonly code = 'EXTERNAL_STORAGE_REQUIRED'

  constructor(message = 'Full file access is required for BaiShou_Root') {
    super(message)
    this.name = 'ExternalStorageRequiredError'
  }
}

export function isExternalStorageRequiredError(error: unknown): boolean {
  return (
    error instanceof ExternalStorageRequiredError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'EXTERNAL_STORAGE_REQUIRED')
  )
}
