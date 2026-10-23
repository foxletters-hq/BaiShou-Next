import type { AgentGateResolution } from '@baishou/shared'

export type LifecycleHandler = (
  resolution: AgentGateResolution,
  context: unknown
) => void | Promise<void>

const lifecycleHandlers = new Map<string, LifecycleHandler>()

export function registerLifecycleHandler(action: string, handler: LifecycleHandler): void {
  lifecycleHandlers.set(action, handler)
}

export function unregisterLifecycleHandler(action: string): void {
  lifecycleHandlers.delete(action)
}

export async function dispatchLifecycleResolved(
  action: string,
  resolution: AgentGateResolution,
  context: unknown
): Promise<void> {
  const handler = lifecycleHandlers.get(action)
  if (!handler) return
  await handler(resolution, context)
}
