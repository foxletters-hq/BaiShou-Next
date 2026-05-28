import { requireNativeModule, EventEmitter } from 'expo-modules-core'

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void
  onMcpHttpRequest: (event: { requestId: string; body: string }) => void
}

const ExpoBaishouServer = requireNativeModule('ExpoBaishouServer')
const emitter = new EventEmitter<ServerEvents>(ExpoBaishouServer)

export function startServer(port: number): number {
  return ExpoBaishouServer.startServer(port)
}

/** Starts NanoHTTPD with MCP routes on the given port (alias of startServer). */
export function startMcpServer(port: number): number {
  return startServer(port)
}

export function stopServer(): void {
  ExpoBaishouServer.stopServer()
}

export function resolveMcpHttpResponse(requestId: string, responseBody: string): boolean {
  return ExpoBaishouServer.resolveMcpHttpResponse(requestId, responseBody)
}

export function onFileReceived(listener: (event: { path: string }) => void) {
  return emitter.addListener('onFileReceived', listener)
}

export function onMcpHttpRequest(listener: (event: { requestId: string; body: string }) => void) {
  return emitter.addListener('onMcpHttpRequest', listener)
}
