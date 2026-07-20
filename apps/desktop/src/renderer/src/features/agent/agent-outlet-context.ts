import type { AgentAssistant } from './components/AgentSidebar'

export type AgentOutletContext = {
  sessions: any[]
  loadSessions?: (reset: boolean, assistantId?: string) => void
  onAssistantSwitched?: (assistant: AgentAssistant) => void | Promise<void>
  currentAssistant?: AgentAssistant
  onShowAssistantPicker?: () => void
  onNewSession?: () => void
  onOpenSessions?: () => void
}
