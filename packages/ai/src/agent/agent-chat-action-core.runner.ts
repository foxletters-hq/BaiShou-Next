import { runRegenerateAction } from './actions/regenerate.action'
import { runEditMessageAction } from './actions/edit-message.action'
import { runResendAction } from './actions/resend.action'
import type { ActionDeps, StreamRunConfig } from './actions/base.action'

export class AgentChatActionCoreRunner {
  public static regenerate(deps: ActionDeps, config: StreamRunConfig, messageId?: string) {
    return runRegenerateAction(deps, config, messageId)
  }

  public static editMessage(
    deps: ActionDeps,
    config: StreamRunConfig,
    messageId: string,
    newText: string
  ) {
    return runEditMessageAction(deps, config, messageId, newText)
  }

  public static resend(deps: ActionDeps, config: StreamRunConfig, messageId: string) {
    return runResendAction(deps, config, messageId)
  }
}
