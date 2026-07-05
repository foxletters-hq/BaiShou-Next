import React from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  ChatCostDialog,
  AssistantPickerSheet,
  ShortcutManagerDialog,
  RecallDialog,
  ModelSwitcherPopup,
  AgentToolsDialog,
  toast
} from '@baishou/ui'
import { isEmbeddingModel, isTtsModel } from '@baishou/shared'
import { useSharedMemoryCopyPreview } from '../../../hooks/useSharedMemoryCopyPreview'
import { usePersistedSharedMemoryCopyPrefix } from '../../../hooks/usePersistedSharedMemoryCopyPrefix'
import type { AgentOutletContext } from '../agent-outlet-context'
import { useSettingsStore } from '@baishou/store'

interface AgentDialogsProps {
  t: any
  i18n: any
  // 状态控制
  showCostDialog: boolean
  setShowCostDialog: (v: boolean) => void
  showAssistantPicker: boolean
  setShowAssistantPicker: (v: boolean) => void
  showShortcutManager: boolean
  setShowShortcutManager: (v: boolean) => void
  showRecallSheet: boolean
  setShowRecallSheet: (v: boolean) => void
  showModelSwitcher: boolean
  setShowModelSwitcher: (v: boolean) => void
  showToolManager: boolean
  setShowToolManager: (v: boolean) => void
  recallLookbackMonths: number
  setRecallLookbackMonths: (v: number) => void

  // 数据 & 方法
  model: {
    currentProviderId: string
    currentModelId: string
    setCurrentProviderId: (id: string) => void
    setCurrentModelId: (id: string) => void
    userManuallySetModelRef: React.MutableRefObject<boolean>
  }
  tokens: {
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadInputTokens: number
    totalCacheWriteInputTokens: number
    estimatedCost: number
  }
  assistants: any[]
  fetchAssistants: () => Promise<void>
  shortcuts: any[]
  addShortcut: (shortcut: any) => Promise<any>
  updateShortcut: (shortcut: any) => Promise<any>
  removeShortcut: (id: string) => Promise<any>
  recall: {
    recallItems: any[]
    isSearchingRecall: boolean
    handleRecallSearch: (query: string, tab: any, mode?: any) => any
    recallSearchMode: 'semantic' | 'text'
    toggleRecallSearchMode: () => void
  }
  toolConfig: any
  pricingLastUpdated: Date | null
  handleRefreshPricing: () => Promise<any>
  currentAssistant: any
  providers: any[]
  inputBarRef: React.RefObject<any>
}

/**
 * 集中管理和渲染 Agent 聊天界面的所有 Dialog/Sheet 弹出面板组件。
 */
export const AgentDialogs: React.FC<AgentDialogsProps> = ({
  t,
  i18n,
  showCostDialog,
  setShowCostDialog,
  showAssistantPicker,
  setShowAssistantPicker,
  showShortcutManager,
  setShowShortcutManager,
  showRecallSheet,
  setShowRecallSheet,
  showModelSwitcher,
  setShowModelSwitcher,
  showToolManager,
  setShowToolManager,
  recallLookbackMonths,
  setRecallLookbackMonths,
  model,
  tokens,
  assistants,
  fetchAssistants,
  shortcuts,
  addShortcut,
  updateShortcut,
  removeShortcut,
  recall,
  toolConfig,
  pricingLastUpdated,
  handleRefreshPricing,
  currentAssistant: _currentAssistant,
  providers,
  inputBarRef
}) => {
  const { onAssistantSwitched } = useOutletContext<AgentOutletContext>()
  const { copyPrefix, setCopyPrefix } = usePersistedSharedMemoryCopyPrefix()
  const { preview: recallCopyPreview, loading: recallCopyPreviewLoading } =
    useSharedMemoryCopyPreview(recallLookbackMonths, showRecallSheet, {
      userCopyPrefix: copyPrefix,
      locale: i18n.language
    })

  return (
    <>
      {/* 计费详情对话框 */}
      <ChatCostDialog
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
          modelName:
            model.currentModelId === 'unknown'
              ? t('agent.no_model_selected', '暂未选择模型')
              : model.currentModelId,
          promptTokens: tokens.totalInputTokens,
          completionTokens: tokens.totalOutputTokens,
          cacheReadTokens: tokens.totalCacheReadInputTokens,
          cacheWriteTokens: tokens.totalCacheWriteInputTokens,
          totalTokens: tokens.totalInputTokens + tokens.totalOutputTokens,
          estimatedCost: `$${tokens.estimatedCost.toFixed(6)}`
        }}
        pricingLastUpdated={pricingLastUpdated}
        onRefreshPricing={handleRefreshPricing}
      />

      {/* 助手切换器抽屉 */}
      <AssistantPickerSheet
        isOpen={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        currentAssistantId={
          _currentAssistant?.id != null ? String(_currentAssistant.id) : undefined
        }
        onRefreshAssistants={fetchAssistants}
        assistants={(assistants || []).map((a) => ({
          ...a,
          id: String(a.id),
          emoji: a.emoji || '✨',
          systemPrompt: a.systemPrompt || '',
          compressSystemPrompt: a.compressSystemPrompt ?? null
        }))}
        pinnedIds={new Set(assistants.filter((a: any) => a.isPinned).map((a) => String(a.id)))}
        onTogglePin={async (id, isPinned) => {
          if (typeof window !== 'undefined' && window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await fetchAssistants()
          }
        }}
        onSelect={(ast) => {
          setShowAssistantPicker(false)
          if (onAssistantSwitched) {
            void onAssistantSwitched({
              id: String(ast.id),
              name: ast.name,
              emoji: ast.emoji || '✨'
            })
          }
        }}
      />

      {/* 快捷指令配置弹窗 */}
      <ShortcutManagerDialog
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={shortcuts as any}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
          setShowShortcutManager(false)
          inputBarRef.current?.insertShortcutContent(shortcut.content)
        }}
      />

      {/* 回忆挖掘对话框 */}
      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recall.recallItems}
        isSearching={recall.isSearchingRecall}
        onSearch={recall.handleRecallSearch}
        searchMode={recall.recallSearchMode}
        onToggleSearchMode={recall.toggleRecallSearchMode}
        lookbackMonths={recallLookbackMonths}
        onMonthsChanged={setRecallLookbackMonths}
        copyPreview={recallCopyPreview}
        copyPreviewLoading={recallCopyPreviewLoading}
        copyPrefix={copyPrefix}
        onCopyPrefixChange={setCopyPrefix}
        onCopyContext={async () => {
          try {
            const contextText = await (window as any).api?.summary?.buildSharedContext?.(
              recallLookbackMonths,
              i18n.language,
              copyPrefix
            )
            if (contextText) {
              await navigator.clipboard.writeText(contextText)
              toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'))
            } else {
              toast.showError(
                t('summary.no_data_to_copy', '当前回溯范围内无已生成的总结回忆')
              )
            }
          } catch (e: any) {
            console.error('[AgentScreen] Copy failed:', e)
            toast.showError(`${t('common.copy_failed', '复制失败')}: ${e?.message || String(e)}`)
          }
        }}
        onInject={(items) => {
          setShowRecallSheet(false)
          if (items.length > 0) {
            const merged = items
              .map((i) => `<memory date="${i.date}" source="${i.title}">\n${i.snippet}\n</memory>`)
              .join('\n\n')
            inputBarRef.current?.insertText(merged)
          }
        }}
      />

      {/* 模型选择浮层 */}
      {showModelSwitcher && (
        <ModelSwitcherPopup
          onClose={() => setShowModelSwitcher(false)}
          providers={providers
            .map((p) => {
              const modelList =
                p.enabledModels && p.enabledModels.length > 0 ? p.enabledModels : p.models || []
              const filteredModels = modelList.filter((m) => !isEmbeddingModel(m) && !isTtsModel(m))
              return {
                id: p.id,
                name: p.name || p.id,
                type: p.type || 'custom',
                models: p.models || [],
                enabledModels: filteredModels
              }
            })
            .filter((p) => p.enabledModels.length > 0)}
          currentProviderId={model.currentProviderId}
          currentModelId={model.currentModelId}
          onSelect={(pid, mid) => {
            model.setCurrentProviderId(pid)
            model.setCurrentModelId(mid)
            model.userManuallySetModelRef.current = true
            setShowModelSwitcher(false)
          }}
        />
      )}

      {/* 工具箱管理弹窗 */}
      <AgentToolsDialog
        isOpen={showToolManager}
        onClose={() => setShowToolManager(false)}
        config={toolConfig}
        onChange={(cfg) => {
          useSettingsStore.getState().setToolManagementConfig(cfg)
        }}
      />
    </>
  )
}
