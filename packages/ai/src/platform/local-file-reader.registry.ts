export type LocalFileReader = {
  readBase64: (path: string) => Promise<string>
}

let injectedReader: LocalFileReader | null = null

/** 移动端在启动时注入 IFileSystem 读盘能力（外部存储 + 沙盒） */
export function registerLocalFileReader(reader: LocalFileReader): void {
  injectedReader = reader
}

export function getLocalFileReader(): LocalFileReader | null {
  return injectedReader
}

export function clearLocalFileReader(): void {
  injectedReader = null
}
