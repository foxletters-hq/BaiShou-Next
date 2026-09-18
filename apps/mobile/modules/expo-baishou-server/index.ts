import { getNative, requireNative } from './expo-baishou-server.native'
import type { McpHttpResponseEnvelope } from './expo-baishou-server.types'

export type {
  ExternalIncrementalSyncScanEntry,
  ExternalPathInfo,
  McpHttpResponseEnvelope,
  MirrorProductionLegacyResult,
  NativeZipArchiveExportResult,
  PickDirectoryResult,
  StoragePermissionState
} from './expo-baishou-server.types'

export * from './expo-baishou-server.events'
export * from './expo-baishou-server.fs'
export * from './expo-baishou-server.probes'
export * from './expo-baishou-server.transfer'

/**
 * MCP 启停与 HTTP 流留在入口：调用方仍从 package main 取这些函数。
 * 文件/传输/探测已按能力拆走，避免再把桥接表堆回单文件。
 */
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

export function resolveMcpHttpResponse(
  requestId: string,
  response: McpHttpResponseEnvelope | string
): boolean {
  const payload =
    typeof response === 'string'
      ? JSON.stringify({
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: response
        })
      : JSON.stringify(response)
  return requireNative().resolveMcpHttpResponse(requestId, payload)
}

export function beginMcpHttpStream(
  requestId: string,
  response: Pick<McpHttpResponseEnvelope, 'statusCode' | 'headers'>
): boolean {
  return requireNative().beginMcpHttpStream(
    requestId,
    JSON.stringify({ statusCode: response.statusCode, headers: response.headers })
  )
}

export function pushMcpHttpStreamChunk(requestId: string, chunk: string): boolean {
  return requireNative().pushMcpHttpStreamChunk(requestId, chunk)
}

export function endMcpHttpStream(requestId: string): boolean {
  return requireNative().endMcpHttpStream(requestId)
}
