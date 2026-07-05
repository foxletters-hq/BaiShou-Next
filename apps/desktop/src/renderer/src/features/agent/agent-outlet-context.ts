import type { AgentAssistant } from './components/AgentSidebar'

export type AgentOutletContext = {
  sessions: any[]
  loadSessions?: (reset: boolean, assistantId?: string) => void
  onAssistantSwitched?: (assistant: AgentAssistant) => void | Promise<void>
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
}
