import { emitAgentGateLifecycle } from '../agent/agent-gate-lifecycle'
import type { BaishouAgentGateEventBus } from './baishou-agent-gate-event-bus'

/** 将进程内 eventBus 转发到全局 onAgentGateLifecycle 订阅方 */
export function bridgeAgentGateEventBus(eventBus: BaishouAgentGateEventBus): () => void {
  return eventBus.subscribe((event) => emitAgentGateLifecycle(event))
}
