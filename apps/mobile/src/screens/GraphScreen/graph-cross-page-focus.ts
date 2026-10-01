export type GraphCanvasLocateEdge = {
  id: string
  fromId: string
  toId: string
  edgeType?: string
  reviewStatus?: string
}

export type GraphCanvasLocateRequest =
  | { type: 'node'; id: string }
  | { type: 'edge'; edge: GraphCanvasLocateEdge }

const canvasListeners = new Set<() => void>()
const opsListeners = new Set<() => void>()
let canvasLocate: GraphCanvasLocateRequest | null = null
let opsNodeId: string | null = null

function emit(listeners: Set<() => void>): void {
  for (const listener of listeners) listener()
}

/** 操作台「查看」：打开全屏图画并定位节点或边 */
export function requestGraphCanvasLocate(request: GraphCanvasLocateRequest): void {
  canvasLocate = request
  emit(canvasListeners)
}

export function consumeGraphCanvasLocate(): GraphCanvasLocateRequest | null {
  const next = canvasLocate
  canvasLocate = null
  return next
}

export function subscribeGraphCanvasLocate(listener: () => void): () => void {
  canvasListeners.add(listener)
  return () => {
    canvasListeners.delete(listener)
  }
}

/** 图画页「在操作台打开」：回到操作台并展开该节点详情 */
export function requestGraphOpsNodeFocus(nodeId: string): void {
  opsNodeId = nodeId
  emit(opsListeners)
}

export function consumeGraphOpsNodeFocus(): string | null {
  const next = opsNodeId
  opsNodeId = null
  return next
}

export function subscribeGraphOpsNodeFocus(listener: () => void): () => void {
  opsListeners.add(listener)
  return () => {
    opsListeners.delete(listener)
  }
}
