export type WorkbenchMouseNavDirection = 'back' | 'forward'

type WorkbenchMouseNavHandler = (direction: WorkbenchMouseNavDirection) => boolean

let handler: WorkbenchMouseNavHandler | null = null
let lastHandledAt = 0

export function setWorkbenchEditorMouseNavHandler(next: WorkbenchMouseNavHandler | null): void {
  handler = next
}

/** 鼠标返回键同一下可能同时走到按键和系统命令，短时间内只处理一次。 */
export function consumeWorkbenchEditorMouseNav(direction: WorkbenchMouseNavDirection): boolean {
  const now = Date.now()
  if (now - lastHandledAt < 250) return true
  lastHandledAt = now
  return handler?.(direction) ?? false
}
