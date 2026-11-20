export type DeepSeekImportErrorCode =
  | 'UNRECOGNIZED_ARCHIVE'
  | 'UNSUPPORTED_VERSION'
  | 'NEWER_VERSION'
  | 'INVALID_JSON'
  | 'EMPTY_ARCHIVE'
  | 'INVALID_TARGET'

export class DeepSeekImportError extends Error {
  public readonly code: DeepSeekImportErrorCode
  public readonly detail?: string

  constructor(code: DeepSeekImportErrorCode, message: string, detail?: string) {
    super(message)
    this.name = 'DeepSeekImportError'
    this.code = code
    this.detail = detail
  }
}
