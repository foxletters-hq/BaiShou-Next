import { WORKBENCH_EXPLORER_DND_MIME } from './workbench-file-explorer-dnd.util'

export function shouldAcceptWorkbenchAgentPanelDrag(
  dataTransfer: DataTransfer | null,
  enabled: boolean
): boolean {
  if (!enabled || !dataTransfer) return false
  const types = Array.from(dataTransfer.types || [])
  return types.includes(WORKBENCH_EXPLORER_DND_MIME) || types.includes('Files')
}
