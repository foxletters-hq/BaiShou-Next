/** 跨 widget 重建保持拖拽会话，避免 document 监听器与闭包 root 泄漏 */
type DragSessionCleanup = () => void

let activeDragCleanup: DragSessionCleanup | null = null

export function beginTableDragSession(cleanup: DragSessionCleanup): void {
  endTableDragSession()
  activeDragCleanup = cleanup
}

export function endTableDragSession(): void {
  const cleanup = activeDragCleanup
  activeDragCleanup = null
  cleanup?.()
}

/** 仅清除会话登记，不执行 cleanup（供 finishDrag 自身调用，避免递归） */
export function clearTableDragSession(): void {
  activeDragCleanup = null
}
