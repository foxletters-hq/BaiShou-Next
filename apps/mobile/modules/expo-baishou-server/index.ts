import { NativeModule, requireNativeModule } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: { requestId: string; body: string }) => void
}

declare class ExpoBaishouServerModule extends NativeModule<ServerEvents> {
  startServer(port: number): number
  stopServer(): void
  resolveMcpHttpResponse(requestId: string, responseBody: string): boolean
}

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

function requireNative() {
  const mod = getNative()
  if (!mod) {
    throw new Error(
      'ExpoBaishouServer 原生模块未编入当前 APK。请执行 pnpm mobile:android:clean 重新安装开发版（不可用 Expo Go）。'
    )
  }
  return mod
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
