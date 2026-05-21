import { registerAssistantIPC } from './agent-assistant.ipc'
import { registerSessionIPC } from './agent-session.ipc'
import { registerChatIPC } from './agent-chat.ipc'
import { registerTtsIPC } from './tts.ipc'

export { getAgentManagers } from './agent-helpers'

export function registerAgentIPC() {
  registerAssistantIPC();
  registerSessionIPC();
  registerChatIPC();
  registerTtsIPC();
}
