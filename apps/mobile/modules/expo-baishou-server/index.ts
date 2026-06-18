import { NativeModule, requireNativeModule } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: {
    requestId: string
    method: string
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
}

export type ExternalPathInfo = {
  exists: boolean
  isDirectory: boolean
  modificationTime: number
  size: number
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

declare class ExpoBaishouServerModule extends NativeModule<ServerEvents> {
  startServer(port: number, authToken?: string | null): number
  stopServer(): void
  resolveMcpHttpResponse(requestId: string, responseBody: string): boolean
  hasAllFilesAccess(): boolean
  openAllFilesAccessSettings(): boolean
  getStoragePermissionOemKey(): string
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
  localGetInfo(path: string): ExternalPathInfo
  localReadDirectory(path: string): string[]
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

const NATIVE_REBUILD_HINT =
  'ExpoBaishouServer 原生模块未编入或版本过旧。请执行 pnpm dev:mobile:clear 重新安装开发版（不可用 Expo Go）。'

let nativeModule: ExpoBaishouServerModule | null | undefined

function getNative(): ExpoBaishouServerModule | null {
  if (nativeModule !== undefined) return nativeModule
  try {
    nativeModule = requireNativeModule<ExpoBaishouServerModule>('ExpoBaishouServer')
  } catch {
    nativeModule = null
  }
  return nativeModule
}

export function isBaishouServerAvailable(): boolean {
  return getNative() != null
}

/** 当前 APK 是否包含外部存储文件 API（与 MCP 服务无关） */
export function isExternalStorageNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.externalMakeDirectory === 'function'
}

/** 当前 APK 是否包含沙盒本地路径 java.io.File API（localGetInfo / localReadDirectory） */
export function isLocalFsNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.localGetInfo === 'function'
}

/** 当前 APK 是否包含原生归档解压/复制 API */
export function isNativeArchiveImportAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeUnzipArchive === 'function'
}

/** 当前 APK 是否包含整棵存储根流式迁移 API（旧版升级复制） */
export function isNativeStorageRootMigrationAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeCopyStorageRootAsync === 'function'
}

export function isNativeArchiveExportAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeZipArchiveExport === 'function'
}

export function isLanUploadNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.uploadLanFileAsync === 'function'
}

export function isNativeDirectoryPickerAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.pickDirectoryAsync === 'function'
}

function requireNative() {
  const mod = getNative()
  if (!mod) {
    throw new Error(NATIVE_REBUILD_HINT)
  }
  return mod
}

function callNativeExternal<T>(op: string, fn: (mod: ExpoBaishouServerModule) => T): T {
  const mod = requireNative()
  if (typeof mod.externalMakeDirectory !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少外部存储 API：${op}）`)
  }
  try {
    return fn(mod)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${op} failed: ${msg}`)
  }
}

export function startServer(port: number, authToken?: string | null): number {
  const mod = requireNative()
  const token = authToken?.trim()
  // 旧版原生模块只接受 port；勿传 null 作为第二参数，否则会触发 bridge 参数个数错误
  if (token) {
    return mod.startServer(port, token)
  }
  return mod.startServer(port)
}

export function startMcpServer(port: number, authToken?: string | null): number {
  return startServer(port, authToken)
}

export function stopServer(): void {
  if (!getNative()) return
  requireNative().stopServer()
}

export type McpHttpResponseEnvelope = {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export function resolveMcpHttpResponse(
  requestId: string,
  response: McpHttpResponseEnvelope | string
): boolean {
  const payload =
    typeof response === 'string'
      ? JSON.stringify({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: response })
      : JSON.stringify(response)
  return requireNative().resolveMcpHttpResponse(requestId, payload)
}

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

export function hasAllFilesAccess(): boolean {
  const mod = getNative()
  if (!mod) return false
  try {
    return mod.hasAllFilesAccess()
  } catch {
    return false
  }
}

export function openAllFilesAccessSettings(): boolean {
  const mod = getNative()
  if (!mod) return false
  try {
    return mod.openAllFilesAccessSettings()
  } catch {
    return false
  }
}

/** xiaomi | huawei | oppo | vivo | samsung | generic */
export function getStoragePermissionOemKey(): string {
  const mod = getNative()
  if (!mod || typeof mod.getStoragePermissionOemKey !== 'function') return 'generic'
  try {
    return mod.getStoragePermissionOemKey() || 'generic'
  } catch {
    return 'generic'
  }
}

export function probeExternalStorageWritable(): boolean {
  const mod = getNative()
  if (!mod || typeof mod.probeExternalStorageWritable !== 'function') return false
  try {
    return mod.probeExternalStorageWritable()
  } catch {
    return false
  }
}

export function getLegacyFlutterStorageRoots(): string[] {
  const mod = getNative()
  if (!mod || typeof mod.getLegacyFlutterStorageRoots !== 'function') return []
  try {
    return mod.getLegacyFlutterStorageRoots() ?? []
  } catch {
    return []
  }
}

export function readLegacyFlutterSharedPreferencesXml(): string | null {
  const mod = getNative()
  if (!mod || typeof mod.readLegacyFlutterSharedPreferencesXml !== 'function') return null
  try {
    return mod.readLegacyFlutterSharedPreferencesXml() ?? null
  } catch {
    return null
  }
}

export function getLegacyFlutterAvatarsDirectory(): string | null {
  const mod = getNative()
  if (!mod || typeof mod.getLegacyFlutterAvatarsDirectory !== 'function') return null
  try {
    return mod.getLegacyFlutterAvatarsDirectory() ?? null
  } catch {
    return null
  }
}

/** Dev 包：尝试把正式包沙盒内的 BaiShou_Root 复制到外部存储 */
export function mirrorProductionLegacyToExternal(): MirrorProductionLegacyResult {
  const mod = getNative()
  if (!mod || typeof mod.mirrorProductionLegacyToExternal !== 'function') {
    return { mirrored: false, reason: 'native_unavailable' }
  }
  try {
    return (mod.mirrorProductionLegacyToExternal() ?? {
      mirrored: false
    }) as MirrorProductionLegacyResult
  } catch {
    return { mirrored: false, reason: 'native_error' }
  }
}

export function externalGetInfo(path: string): ExternalPathInfo {
  return callNativeExternal('externalGetInfo', (mod) => mod.externalGetInfo(path))
}

export function externalMakeDirectory(path: string, intermediates = true): void {
  callNativeExternal('externalMakeDirectory', (mod) =>
    mod.externalMakeDirectory(path, intermediates)
  )
}

export function externalWriteString(path: string, content: string): void {
  callNativeExternal('externalWriteString', (mod) => mod.externalWriteString(path, content))
}

export function externalAppendString(path: string, content: string): void {
  callNativeExternal('externalAppendString', (mod) => mod.externalAppendString(path, content))
}

export function externalWriteBase64(path: string, base64: string): void {
  callNativeExternal('externalWriteBase64', (mod) => mod.externalWriteBase64(path, base64))
}

export function externalReadString(path: string): string {
  return callNativeExternal('externalReadString', (mod) => mod.externalReadString(path))
}

export function externalReadBase64(path: string): string {
  return callNativeExternal('externalReadBase64', (mod) => mod.externalReadBase64(path))
}

export function externalDelete(path: string, idempotent = true): void {
  callNativeExternal('externalDelete', (mod) => mod.externalDelete(path, idempotent))
}

export function externalReadDirectory(path: string): string[] {
  return callNativeExternal('externalReadDirectory', (mod) => mod.externalReadDirectory(path))
}

export function localGetInfo(path: string): ExternalPathInfo {
  return callNativeExternal('localGetInfo', (mod) => mod.localGetInfo(path))
}

export function localReadDirectory(path: string): string[] {
  return callNativeExternal('localReadDirectory', (mod) => mod.localReadDirectory(path))
}

export function localAppendString(path: string, content: string): void {
  callNativeExternal('localAppendString', (mod) => mod.localAppendString(path, content))
}

export function onArchiveImportProgress(
  listener: (event: { phase: string; current: number; total: number; detail: string }) => void
) {
  const mod = requireNative()
  return mod.addListener('onArchiveImportProgress', listener)
}

export async function nativeUnzipArchive(
  zipPath: string,
  destDir: string,
  onProgress?: (event: { current: number; total: number; detail: string }) => void
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeUnzipArchive !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeUnzipArchive）`)
  }
  const subscription = onProgress
    ? onArchiveImportProgress((event) => {
        if (event.phase !== 'unzip') return
        onProgress({
          current: event.current,
          total: event.total,
          detail: event.detail
        })
      })
    : null
  try {
    await mod.nativeUnzipArchive(zipPath, destDir)
  } finally {
    subscription?.remove()
  }
}

export type NativeZipArchiveExportResult = {
  outputPath: string
  entryCount: number
  uncompressedBytes: number
  zipBytes: number
}

export async function nativeZipArchiveExport(
  storageRoot: string,
  supplementRoot: string | null,
  outputZip: string
): Promise<NativeZipArchiveExportResult> {
  const mod = requireNative()
  if (typeof mod.nativeZipArchiveExport !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeZipArchiveExport）`)
  }
  return mod.nativeZipArchiveExport(storageRoot, supplementRoot, outputZip)
}

export async function nativeCopyArchiveExtractToRoot(
  extractDir: string,
  rootDir: string
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeCopyArchiveExtractToRoot !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeCopyArchiveExtractToRoot）`)
  }
  await mod.nativeCopyArchiveExtractToRoot(extractDir, rootDir)
}

export async function nativeCopyStorageRootAsync(
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (itemName: string) => void
): Promise<void> {
  const mod = requireNative()
  if (typeof mod.nativeCopyStorageRootAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 nativeCopyStorageRootAsync）`)
  }
  const subscription = onProgress
    ? onStorageRootCopyProgress((event) => onProgress(event.itemName))
    : null
  try {
    await mod.nativeCopyStorageRootAsync(sourceRoot, targetRoot)
  } finally {
    subscription?.remove()
  }
}

export async function uploadLanFileAsync(
  url: string,
  filePath: string
): Promise<{ status: number }> {
  const mod = requireNative()
  if (typeof mod.uploadLanFileAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 uploadLanFileAsync）`)
  }
  return mod.uploadLanFileAsync(url, filePath)
}

export function externalMove(fromPath: string, toPath: string): void {
  callNativeExternal('externalMove', (mod) => mod.externalMove(fromPath, toPath))
}

export function externalCopy(fromPath: string, toPath: string): void {
  callNativeExternal('externalCopy', (mod) => mod.externalCopy(fromPath, toPath))
}

export async function externalCopyAsync(fromPath: string, toPath: string): Promise<void> {
  const mod = requireNative()
  if (typeof mod.externalCopyAsync !== 'function') {
    externalCopy(fromPath, toPath)
    return
  }
  await mod.externalCopyAsync(fromPath, toPath)
}

/** 外部存储 ↔ 沙盒等任意路径间流式复制，避免整文件 base64 进 JS */
export async function externalCopyFileAsync(fromPath: string, toPath: string): Promise<void> {
  const mod = requireNative()
  if (typeof mod.externalCopyFileAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 externalCopyFileAsync）`)
  }
  await mod.externalCopyFileAsync(fromPath, toPath)
}

export async function pickDirectoryAsync(): Promise<PickDirectoryResult> {
  const mod = requireNative()
  if (typeof mod.pickDirectoryAsync !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少 pickDirectoryAsync）`)
  }
  return mod.pickDirectoryAsync()
}
