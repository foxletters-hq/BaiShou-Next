import { NativeModule, requireNativeModule } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: { requestId: string; body: string; authorization?: string }) => void
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
  externalWriteBase64(path: string, base64: string): void
  externalReadString(path: string): string
  externalReadBase64(path: string): string
  externalDelete(path: string, idempotent: boolean): void
  externalReadDirectory(path: string): string[]
  externalMove(fromPath: string, toPath: string): void
  externalCopy(fromPath: string, toPath: string): void
  externalCopyAsync(fromPath: string, toPath: string): Promise<void>
  externalCopyFileAsync(fromPath: string, toPath: string): Promise<void>
  pickDirectoryAsync(): Promise<PickDirectoryResult>
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

export function resolveMcpHttpResponse(requestId: string, responseBody: string): boolean {
  return requireNative().resolveMcpHttpResponse(requestId, responseBody)
}

export function onFileReceived(listener: (event: { path: string }) => void) {
  const mod = getNative()
  if (!mod) {
    return { remove: () => {} }
  }
  return mod.addListener('onFileReceived', listener)
}

export function onMcpHttpRequest(
  listener: (event: { requestId: string; body: string; authorization?: string }) => void
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

export type MirrorProductionLegacyResult = {
  mirrored?: boolean
  productionInstalled?: boolean
  journalFilesCopied?: number
  reason?: string
}

/** Dev 包：尝试把正式包沙盒内的 BaiShou_Root 复制到外部存储 */
export function mirrorProductionLegacyToExternal(): MirrorProductionLegacyResult {
  const mod = getNative()
  if (!mod || typeof mod.mirrorProductionLegacyToExternal !== 'function') {
    return { mirrored: false, reason: 'native_unavailable' }
  }
  try {
    return (mod.mirrorProductionLegacyToExternal() ?? { mirrored: false }) as MirrorProductionLegacyResult
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
