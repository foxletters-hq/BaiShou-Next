import i18n from 'i18next'
import type { AgentDbRuntime } from './mobile-agent-db-runtime'
import { getAgentDbRuntime } from './mobile-agent-db-runtime-ref'
import { mobileAgentDbRecovery } from './mobile-agent-db-recovery.coordinator'

function requireAgentDbRuntime(): AgentDbRuntime {
  const runtime = getAgentDbRuntime()
  if (!runtime) {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.agent.db.write.util.L8', 'Agent DB 未就绪')
    )
  }
  return runtime
}

/** 在 corruption 自愈后使用最新 runtime 重试写入 */
export async function runMobileAgentDbWrite<T>(
  reason: string,
  write: (runtime: AgentDbRuntime) => Promise<T>
): Promise<T> {
  return mobileAgentDbRecovery.runWithRecovery(
    () => write(requireAgentDbRuntime()),
    reason,
    () => write(requireAgentDbRuntime())
  )
}
