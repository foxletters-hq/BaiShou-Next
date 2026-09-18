import { NativeModule } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: {
    requestId: string
    method: string
    /** 含 query 的路径；旧版原生可能缺失，默认按 /mcp */
    path?: string
    headers: Record<string, string>
    body: string
  }) => void
  onLanUploadStarted: (event: { totalBytes: number }) => void
  onLanUploadProgress: (event: { writtenBytes: number; totalBytes: number }) => void
  onStorageRootCopyProgress: (event: { itemName: string }) => void
  onArchiveImportProgress: (event: {
    phase: string
    current: number
    total: number
    detail: string
  }) => void
  onSyncHttpTransferProgress: (event: {
    filePath: string
    writtenBytes: number
    totalBytes: number
  }) => void
}

export type ExternalPathInfo = {
  exists: boolean
  isDirectory: boolean
  modificationTime: number
  size: number
}

export type ExternalIncrementalSyncScanEntry = {
  relPath: string
  size: number
  mtimeMs: number
  isFile: boolean
}

export type PickDirectoryResult =
  | { canceled: true }
  | { canceled: false; path: string; uri: string }

export type MirrorProductionLegacyResult = {
  mirrored?: boolean
  productionInstalled?: boolean
  journalFilesCopied?: number
  reason?: string
}

export type McpHttpResponseEnvelope = {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export type StoragePermissionState = {
  allFilesManager: boolean
  appOpsAllFiles: boolean
  standardStorage: boolean
  probeWritable: boolean
  safTree: boolean
  effectiveAccess: boolean
}

export type NativeZipArchiveExportResult = {
  outputPath: string
  entryCount: number
  uncompressedBytes: number
  zipBytes: number
}

/**
 * 原生模块方法表。拆到独立类型文件，是为了让探测 / 文件 / 传输实现能共用同一份声明，
 * 而不把 50+ 方法签名复制进每个能力文件。
 */
export declare class ExpoBaishouServerModule extends NativeModule<ServerEvents> {
  startServer(port: number, authToken?: string | null): number
  stopServer(): void
  resolveMcpHttpResponse(requestId: string, responseBody: string): boolean
  beginMcpHttpStream(requestId: string, responseBody: string): boolean
  pushMcpHttpStreamChunk(requestId: string, chunk: string): boolean
  endMcpHttpStream(requestId: string): boolean
  hasAllFilesAccess(): boolean
  openAllFilesAccessSettings(): boolean
  getStoragePermissionOemKey(): string
  getStoragePermissionState(): Record<string, boolean>
  probeExternalStorageWritable(): boolean
  getLegacyFlutterStorageRoots(): string[]
  readLegacyFlutterSharedPreferencesXml(): string | null
  getLegacyFlutterAvatarsDirectory(): string | null
  externalGetInfo(path: string): ExternalPathInfo
  externalMakeDirectory(path: string, intermediates: boolean): void
  externalWriteString(path: string, content: string): void
  externalAppendString(path: string, content: string): void
  externalWriteBase64(path: string, base64: string): void
  externalReadString(path: string): string
  externalReadBase64(path: string): string
  externalDelete(path: string, idempotent: boolean): void
  externalReadDirectory(path: string): string[]
  externalScanIncrementalSyncFiles(path: string): ExternalIncrementalSyncScanEntry[]
  localGetInfo(path: string): ExternalPathInfo
  localReadDirectory(path: string): string[]
  localScanIncrementalSyncFiles(path: string): ExternalIncrementalSyncScanEntry[]
  localMd5Hex(path: string): string
  externalMd5Hex(path: string): string
  readFileChunkBase64(path: string, position: number, length: number): string
  cancelHttpUploadFile(filePath?: string | null): void
  httpUploadFileAsync(
    url: string,
    filePath: string,
    method: string,
    headers: Record<string, string>
  ): Promise<{ status: number }>
  localAppendString(path: string, content: string): void
  nativeUnzipArchive(zipPath: string, destDir: string): Promise<void>
  nativeZipArchiveExport(
    storageRoot: string,
    supplementRoot: string | null,
    outputZip: string
  ): Promise<{
    outputPath: string
    entryCount: number
    uncompressedBytes: number
    zipBytes: number
  }>
  nativeCopyArchiveExtractToRoot(extractDir: string, rootDir: string): Promise<void>
  nativeCopyStorageRootAsync(sourceRoot: string, targetRoot: string): Promise<void>
  uploadLanFileAsync(url: string, filePath: string): Promise<{ status: number }>
  externalMove(fromPath: string, toPath: string): void
  externalCopy(fromPath: string, toPath: string): void
  externalCopyAsync(fromPath: string, toPath: string): Promise<void>
  externalCopyFileAsync(fromPath: string, toPath: string): Promise<void>
  pickDirectoryAsync(): Promise<PickDirectoryResult>
  mirrorProductionLegacyToExternal(): MirrorProductionLegacyResult
}
