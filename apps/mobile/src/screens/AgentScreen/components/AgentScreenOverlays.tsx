import React from 'react'
import * as Clipboard from 'expo-clipboard'
import type { PromptShortcut, SharedMemoryCopyPreview } from '@baishou/shared'
import {
  ChatCostDialog,
  PromptShortcutSheet,
  RecallDialog,
  type MockAgentAssistant,
  type RecallItem
} from '@baishou/ui/native'
import { AgentDrawer } from '../../../components/AgentDrawer'
import { AssistantPicker } from '../../../components/AssistantPicker'
import { ModelSwitcher } from '../../../components/ModelSwitcher'
import {
  ContextChainDialog,
  type ContextChainDialogProps
} from '../../../components/ContextChainDialog'

type ContextDialogState = {
  visible: boolean
  sessionId?: string
  message: ContextChainDialogProps['message']
  flatEntries: NonNullable<ContextChainDialogProps['flatEntries']>
  meta?: ContextChainDialogProps['meta']
  compressedContent?: string
  systemPrompt?: string
}

export type AgentScreenOverlaysProps = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  currentAssistant: any
  resolvedCurrentAvatarUri: string | null | undefined
  pinnedAssistants: any[]
  sessions: any[]
  sessionListScrollKey: number
  hasMoreSessions: boolean
  isLoadingMoreSessions: boolean
  loadSessions: (reset?: boolean, assistantId?: string) => Promise<void>
  currentSessionId: string | null
  handleSelectSession: (id: string) => Promise<void> | void
  handleCreateSession: (opts: any) => Promise<string | null>
  refreshSessionList: () => void
  setShowAssistantPicker: (v: boolean) => void
  handleSelectAssistantWithTracking: (assistant: any) => Promise<void>
  handlePinSession: (id: string, pinned: boolean) => Promise<void> | void
  handleDeleteSession: (id: string) => Promise<void> | void
  handleRenameSession: (id: string, name: string) => Promise<void> | void
  showAssistantPicker: boolean
  showModelSwitcher: boolean
  setShowModelSwitcher: (v: boolean) => void
  handleSelectModel: (providerId: string, modelId: string) => void
  currentProviderId: string | null
  currentModelId: string | null
  showCostDialog: boolean
  setShowCostDialog: (v: boolean) => void
  displayModelName: string | null
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheWriteInputTokens: number
  estimatedCost: number
  pricingLastUpdated: Date | null
  handleRefreshPricing: () => Promise<{ success: boolean; error?: string }>
  showShortcutSheet: boolean
  setShowShortcutSheet: (v: boolean) => void
  shortcuts: PromptShortcut[]
  handleShortcutSelect: (shortcut: PromptShortcut) => void
  addShortcut: (shortcut: PromptShortcut) => Promise<void>
  updateShortcut: (shortcut: PromptShortcut) => Promise<void>
  deleteShortcut: (id: string) => Promise<void>
  reorderShortcuts: (shortcuts: PromptShortcut[]) => Promise<void>
  showRecallSheet: boolean
  setShowRecallSheet: (v: boolean) => void
  recallItems: any[]
  isSearchingRecall: boolean
  handleRecallSearch: (
    query: string,
    tab: 'diary' | 'memory',
    mode?: 'semantic' | 'text'
  ) => void | Promise<void>
  handleInjectRecall: (items: RecallItem[]) => void
  recallSearchMode: 'semantic' | 'text'
  toggleRecallSearchMode: () => void
  recallLookbackMonths: number
  setRecallLookbackMonths: (months: number) => void
  services: any
  i18n: { language: string }
  copyPrefix: string
  setCopyPrefix: (prefix: string) => void
  recallCopyPreview: SharedMemoryCopyPreview | null
  recallCopyPreviewLoading: boolean
  toast: { showSuccess: (msg: string) => void; showError: (msg: string) => void }
  t: (key: string, fallback?: string) => string
  contextDialogState: ContextDialogState
  setContextDialogState: React.Dispatch<React.SetStateAction<ContextDialogState>>
  activeContextSessionId: string | undefined
  contextRecompressJob: any
  isCompressing: boolean
  compressionPhase: string
  compressionText: string
  compressionReasoning: string
  runContextRecompress: (sessionId: string) => Promise<void>
  dismissContextRecompressError: () => void
  pickerAssistants: MockAgentAssistant[]
  loadAssistants: () => void | Promise<void>
}

export function AgentScreenOverlays(props: AgentScreenOverlaysProps) {
  const {
    drawerOpen,
    setDrawerOpen,
    currentAssistant,
    resolvedCurrentAvatarUri,
    pinnedAssistants,
    sessions,
    sessionListScrollKey,
    hasMoreSessions,
    isLoadingMoreSessions,
    loadSessions,
    currentSessionId,
    handleSelectSession,
    handleCreateSession,
    refreshSessionList,
    setShowAssistantPicker,
    handleSelectAssistantWithTracking,
    handlePinSession,
    handleDeleteSession,
    handleRenameSession,
    showAssistantPicker,
    showModelSwitcher,
    setShowModelSwitcher,
    handleSelectModel,
    currentProviderId,
    currentModelId,
    showCostDialog,
    setShowCostDialog,
    displayModelName,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadInputTokens,
    totalCacheWriteInputTokens,
    estimatedCost,
    pricingLastUpdated,
    handleRefreshPricing,
    showShortcutSheet,
    setShowShortcutSheet,
    shortcuts,
    handleShortcutSelect,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    showRecallSheet,
    setShowRecallSheet,
    recallItems,
    isSearchingRecall,
    handleRecallSearch,
    handleInjectRecall,
    recallSearchMode,
    toggleRecallSearchMode,
    recallLookbackMonths,
    setRecallLookbackMonths,
    services,
    i18n,
    copyPrefix,
    setCopyPrefix,
    recallCopyPreview,
    recallCopyPreviewLoading,
    toast,
    t,
    contextDialogState,
    setContextDialogState,
    activeContextSessionId,
    contextRecompressJob,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    runContextRecompress,
    dismissContextRecompressError,
    pickerAssistants,
    loadAssistants
  } = props

  return (
    <>
      <AgentDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentAssistant={
          currentAssistant
            ? {
                id: currentAssistant.id,
                name: currentAssistant.name,
                description: currentAssistant.description,
                emoji: currentAssistant.emoji,
                avatarPath: currentAssistant.avatarPath ?? undefined,
                displayAvatarUri: resolvedCurrentAvatarUri || undefined,
                assistantKind: currentAssistant.assistantKind
              }
            : null
        }
        pinnedAssistants={pinnedAssistants}
        sessions={sessions}
        sessionListScrollKey={sessionListScrollKey}
        hasMoreSessions={hasMoreSessions}
        isLoadingMoreSessions={isLoadingMoreSessions}
        onLoadMoreSessions={() => void loadSessions(false)}
        onRefreshSessions={() => void loadSessions(true)}
        selectedSessionId={currentSessionId || undefined}
        onSelectSession={handleSelectSession}
        onCreateSession={() => {
          void handleCreateSession({
            assistantId: currentAssistant?.id,
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined
          }).then((sessionId) => {
            if (sessionId) refreshSessionList()
          })
        }}
        onShowAssistantPicker={() => setShowAssistantPicker(true)}
        onSelectAssistant={(assistant) => {
          void handleSelectAssistantWithTracking(assistant)
        }}
        onPinSession={handlePinSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <AssistantPicker
        isVisible={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        onSelect={(a) => void handleSelectAssistantWithTracking(a)}
        selectedAssistantId={currentAssistant?.id}
        assistants={pickerAssistants}
        onAssistantsChanged={() => void loadAssistants()}
      />

      <ModelSwitcher
        isVisible={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        onSelect={handleSelectModel}
        currentProviderId={currentProviderId || undefined}
        currentModelId={currentModelId || undefined}
      />

      <ChatCostDialog
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
          modelName: displayModelName || t('agent.no_model_selected', '暂未选择模型'),
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadInputTokens,
          cacheWriteTokens: totalCacheWriteInputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          estimatedCost: `$${estimatedCost.toFixed(6)}`
        }}
        pricingLastUpdated={pricingLastUpdated}
        onRefreshPricing={handleRefreshPricing}
      />

      <PromptShortcutSheet
        visible={showShortcutSheet}
        onClose={() => setShowShortcutSheet(false)}
        shortcuts={shortcuts}
        onSelect={handleShortcutSelect}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={deleteShortcut}
        onReorder={reorderShortcuts}
      />

      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recallItems}
        isSearching={isSearchingRecall}
        onSearch={handleRecallSearch}
        onInject={handleInjectRecall}
        searchMode={recallSearchMode}
        onToggleSearchMode={toggleRecallSearchMode}
        lookbackMonths={recallLookbackMonths}
        onMonthsChanged={setRecallLookbackMonths}
        onCopyContext={async () => {
          try {
            const contextText = await services?.buildSharedContext?.(
              recallLookbackMonths,
              i18n.language,
              copyPrefix
            )
            if (contextText) {
              await Clipboard.setStringAsync(contextText)
              toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'))
            }
          } catch (e: unknown) {
            console.error('[AgentScreen] Copy shared context failed:', e)
            toast.showError(t('common.copy_failed', '复制失败'))
          }
        }}
        onCopyDiarySnippet={async (snippet) => {
          try {
            await Clipboard.setStringAsync(snippet)
            toast.showSuccess(t('recall.copy_success', '已复制记忆到剪贴板！'))
          } catch {
            toast.showError(t('common.copy_failed', '复制失败'))
          }
        }}
        copyPreview={recallCopyPreview}
        copyPreviewLoading={recallCopyPreviewLoading}
        copyPrefix={copyPrefix}
        onCopyPrefixChange={setCopyPrefix}
      />

      <ContextChainDialog
        visible={contextDialogState.visible}
        onClose={() => setContextDialogState((prev) => ({ ...prev, visible: false }))}
        message={contextDialogState.message}
        flatEntries={contextDialogState.flatEntries}
        meta={contextDialogState.meta}
        compressedContent={contextDialogState.compressedContent}
        systemPrompt={contextDialogState.systemPrompt}
        sessionId={activeContextSessionId}
        recompressBusy={contextRecompressJob?.status === 'running'}
        recompressStartedAt={
          contextRecompressJob?.status === 'running' ? contextRecompressJob.startedAt : undefined
        }
        recompressStreamText={isCompressing && compressionPhase === 'manual' ? compressionText : ''}
        recompressStreamReasoning={
          isCompressing && compressionPhase === 'manual' ? compressionReasoning : ''
        }
        recompressError={
          contextRecompressJob?.status === 'error' ? contextRecompressJob.error : null
        }
        onRecompress={() => {
          const sid = contextDialogState.sessionId ?? currentSessionId
          if (sid) void runContextRecompress(sid)
        }}
        onRecompressDismissError={dismissContextRecompressError}
      />
    </>
  )
}
