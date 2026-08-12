/** Legacy SSE path helpers（无原生/SDK 依赖，便于单测） */

export function parseSseSessionId(path: string): string | undefined {
  const queryIndex = path.indexOf('?')
  if (queryIndex < 0) return undefined
  const params = new URLSearchParams(path.slice(queryIndex + 1))
  const sessionId = params.get('sessionId')?.trim()
  return sessionId || undefined
}

export function isMcpSsePath(path: string): boolean {
  const pathname = path.split('?')[0] || path
  return pathname === '/sse' || pathname === '/sse/'
}

export function isMcpMessagePath(path: string): boolean {
  const pathname = path.split('?')[0] || path
  return pathname === '/message'
}

export function buildSseEndpointEvent(sessionId: string, messageEndpoint = '/message'): string {
  const endpointPath = `${messageEndpoint}?sessionId=${encodeURIComponent(sessionId)}`
  return `event: endpoint\ndata: ${endpointPath}\n\n`
}

export function buildSseMessageEvent(payload: unknown): string {
  return `event: message\ndata: ${JSON.stringify(payload)}\n\n`
}
