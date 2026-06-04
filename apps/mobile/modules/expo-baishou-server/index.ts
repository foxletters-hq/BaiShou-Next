import { NativeModule, requireNativeModule } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: { requestId: string; body: string }) => void
}

export type ExternalPathInfo = {
  exists: boolean
  isDirectory: boolean
  modificationTime: number
  size: number
}

declare class ExpoBaishouServerModule extends NativeModule<ServerEvents> {
  startServer(port: number): number
  stopServer(): void
  resolveMcpHttpResponse(requestId: string, responseBody: string): boolean
  hasAllFilesAccess(): boolean
  openAllFilesAccessSettings(): boolean
  probeExternalStorageWritable(): boolean
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

export function startServer(port: number): number {
  return requireNative().startServer(port)
}

export function startMcpServer(port: number): number {
  return startServer(port)
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

export function onMcpHttpRequest(listener: (event: { requestId: string; body: string }) => void) {
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

export function probeExternalStorageWritable(): boolean {
  const mod = getNative()
  if (!mod || typeof mod.probeExternalStorageWritable !== 'function') return false
  try {
    return mod.probeExternalStorageWritable()
  } catch {
    return false
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
