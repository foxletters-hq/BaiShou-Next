import React from 'react'
import { ContextChainPanel, AssistantPickerSheet, SessionModelMenu } from '@baishou/ui'
import type { ReasoningEffortSetting } from '@baishou/shared'
import { AssistantCreateModal } from '../agent/components/AssistantCreateModal'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import type { useAgentWorkspaceChrome } from './hooks/useAgentWorkspaceChrome'
import type { useWorkspaceContextChain } from './hooks/useWorkspaceContextChain'
import { toSessionModelMenuProviders } from './utils/agent-workspace-screen.util'

type WorkspaceChrome = ReturnType<typeof useAgentWorkspaceChrome>
type ContextChain = ReturnType<typeof useWorkspaceContextChain>

export interface AgentWorkspaceScreenOverlaysProps {
  chrome: WorkspaceChrome
  contextChain: ContextChain
  streamBindId?: string
  sessionId?: string
  navigate: (path: string) => void
  reasoningEffort: ReasoningEffortSetting
  onReasoningEffortChange: (value: ReasoningEffortSetting) => void
  reasoningControl: Parameters<typeof SessionModelMenu>[0]['reasoningControl']
  modelReasoningPreviews: Parameters<typeof SessionModelMenu>[0]['modelReasoningPreviews']
  modelMenuAnchor: DOMRect | null
}

export const AgentWorkspaceScreenOverlays: React.FC<AgentWorkspaceScreenOverlaysProps> = ({
  chrome,
  contextChain,
  streamBindId,
  sessionId,
  navigate,
  reasoningEffort,
  onReasoningEffortChange,
  reasoningControl,
  modelReasoningPreviews,
  modelMenuAnchor
}) => {
  return (
    <>
      {chrome.showModelSwitcher ? (
        <SessionModelMenu
          onClose={() => chrome.setShowModelSwitcher(false)}
          providers={toSessionModelMenuProviders(chrome.providers)}
          currentProviderId={chrome.model.currentProviderId}
          currentModelId={chrome.model.currentModelId}
          onSelect={(providerId, modelId) => {
            chrome.model.userManuallySetModelRef.current = true
            chrome.model.setCurrentProviderId(providerId)
            chrome.model.setCurrentModelId(modelId)
          }}
          onManageProviders={() => navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={onReasoningEffortChange}
          reasoningControl={reasoningControl}
          modelReasoningPreviews={modelReasoningPreviews}
          anchorRect={modelMenuAnchor}
        />
      ) : null}

      <AssistantPickerSheet
        isOpen={chrome.showAssistantPicker}
        assistants={chrome.assistants.map((assistant) => ({
          ...assistant,
          id: String(assistant.id),
          emoji: assistant.emoji || '✨',
          systemPrompt: assistant.systemPrompt || '',
          compressSystemPrompt: assistant.compressSystemPrompt ?? null
        }))}
        currentAssistantId={chrome.selectedAssistantId}
        onSelect={(assistant) => chrome.handleAssistantSelected(assistant)}
        onClose={() => chrome.setShowAssistantPicker(false)}
        onRefreshAssistants={() => chrome.fetchAssistants()}
        pinnedIds={new Set(chrome.pinnedIds)}
        onTogglePin={async (id, isPinned) => {
          if (window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await chrome.fetchAssistants()
          }
        }}
        onCreateNew={chrome.openCreateAssistant}
      />

      <AssistantCreateModal
        isOpen={chrome.isCreateAssistantOpen}
        assistantCount={chrome.assistants.length}
        onClose={() => chrome.setIsCreateAssistantOpen(false)}
        onBackToPicker={() => chrome.setShowAssistantPicker(true)}
        onCreated={chrome.fetchAssistants}
      />

      {contextChain.state.flatEntries ? (
        <ContextChainPanel
          key={contextChain.state.message?.id ?? 'workspace-context-chain'}
          isOpen={contextChain.state.isOpen}
          onClose={contextChain.close}
          message={
            contextChain.state.message ?? {
              id: '',
              sessionId: streamBindId ?? sessionId ?? '',
              role: 'assistant',
              content: '',
              timestamp: new Date()
            }
          }
          flatEntries={contextChain.state.flatEntries}
          meta={contextChain.state.meta}
          compressedContent={contextChain.state.compressedContent}
          systemPrompt={contextChain.state.systemPrompt}
          sessionId={contextChain.state.sessionId ?? streamBindId ?? sessionId}
        />
      ) : null}
    </>
  )
}
