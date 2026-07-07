import i18n from 'i18next'
import { AgentDbRecoveryCoordinator } from '@baishou/database'
import { logger } from '@baishou/shared'
import { appendDiagnosticBreadcrumb } from './mobile-diagnostic-log.service'

export class MobileAgentDbRecoveryCoordinator extends AgentDbRecoveryCoordinator {}

export const mobileAgentDbRecovery = new MobileAgentDbRecoveryCoordinator()

mobileAgentDbRecovery.setDiagnostics({
  logger: {
    error: (message, error) => logger.error(message, error as Error),
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message)
  },
  onRecoverStart: (reason) => {
    appendDiagnosticBreadcrumb(`[AgentDbRecovery] 检测到 Agent 数据库损坏，开始自愈: ${reason}`)
  },
  onRecoverComplete: () => {
    appendDiagnosticBreadcrumb(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.agent.db.recovery.coordinator.L19',
        '[AgentDbRecovery] Agent 数据库自愈完成，已从磁盘重新同步缓存'
      )
    )
  },
  onRecoverFailed: (error) => {
    appendDiagnosticBreadcrumb(
      `[AgentDbRecovery] 自愈失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
})
