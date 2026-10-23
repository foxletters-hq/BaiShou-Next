import { resolveReasoningEffortForSlot } from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'

/** 全局对话用途分档；未写则为 Default */
export function useDialogueSlotEffort() {
  return useSettingsStore((state) =>
    resolveReasoningEffortForSlot(state.globalModels?.reasoningEffortBySlot, 'dialogue')
  )
}
