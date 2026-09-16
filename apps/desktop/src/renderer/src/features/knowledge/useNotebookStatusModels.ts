import { useCallback, useState } from 'react'
import { useDialog } from '@baishou/ui'
import { clampOcrConcurrency, normalizeKnowledgeDefaultExtractEngine } from '@baishou/shared'
import { getDefaultGlobalModels, useSettingsStore } from '@baishou/store'
import type { KnowledgeModelMenuKind } from './notebook-model-menu.util'
import {
  resolveNotebookStatusPicker,
  type NotebookStatusPickKey
} from './notebook-open-guide.util'

export type NotebookModelPicker = {
  kind: KnowledgeModelMenuKind
  field: 'embedding' | 'graph' | 'vision'
  persistVision: boolean
  anchor: DOMRect | null
}

export function useNotebookStatusModels(input: {
  engine: 'simple' | 'ocr' | 'vision'
  ocrLanguage: string
  ocrConcurrency: number
  setVisionProviderId: (id: string | null) => void
  setVisionModelId: (id: string | null) => void
  setShowSettings: (open: boolean) => void
  onError: (message: string) => void
}) {
  const {
    engine,
    ocrLanguage,
    ocrConcurrency,
    setVisionProviderId,
    setVisionModelId,
    setShowSettings,
    onError
  } = input
  const dialog = useDialog()
  const setGlobalModels = useSettingsStore((s) => s.setGlobalModels)
  const [picker, setPicker] = useState<NotebookModelPicker | null>(null)

  const closePicker = useCallback(() => setPicker(null), [])

  const persistVision = useCallback(
    async (providerId: string | null, modelId: string | null) => {
      await window.api.knowledge.setConfig({
        defaultExtractEngine: normalizeKnowledgeDefaultExtractEngine(engine),
        ocrLanguage,
        ocrConcurrency: clampOcrConcurrency(ocrConcurrency),
        visionProviderId: providerId,
        visionModelId: modelId
      })
    },
    [engine, ocrConcurrency, ocrLanguage]
  )

  const pickStatusRow = useCallback(
    (key: NotebookStatusPickKey, anchor: DOMRect) => {
      const next = resolveNotebookStatusPicker(key, anchor)
      if (next.action === 'settings') {
        setShowSettings(true)
        return
      }
      setPicker({
        kind: next.kind,
        field: next.field,
        persistVision: next.persistVision,
        anchor: next.anchor
      })
    },
    [setShowSettings]
  )

  const openVisionPicker = useCallback((anchor: DOMRect | null) => {
    setPicker({ kind: 'vision', field: 'vision', persistVision: false, anchor })
  }, [])

  const applyGlobalModel = useCallback(
    async (field: 'embedding' | 'graph', providerId: string, modelId: string) => {
      const current = useSettingsStore.getState().globalModels
      const next = { ...getDefaultGlobalModels(), ...current }
      if (field === 'embedding') {
        const switching = Boolean(
          next.globalEmbeddingProviderId &&
            next.globalEmbeddingModelId &&
            (next.globalEmbeddingProviderId !== providerId ||
              next.globalEmbeddingModelId !== modelId)
        )
        if (switching) {
          const confirmed = await dialog.confirm(
            '新模型可能与现有向量不兼容，更换后将在后台重新嵌入日记数据。是否继续？',
            '更换嵌入模型？'
          )
          if (!confirmed) return
        }
        const rollback = {
          globalEmbeddingProviderId: next.globalEmbeddingProviderId,
          globalEmbeddingModelId: next.globalEmbeddingModelId,
          globalEmbeddingDimension: next.globalEmbeddingDimension ?? 0
        }
        await setGlobalModels({
          ...next,
          globalEmbeddingProviderId: providerId,
          globalEmbeddingModelId: modelId
        })
        if (switching) {
          try {
            await (window as any).api?.rag?.triggerMigration({ rollbackConfig: rollback })
          } catch (error) {
            onError(error instanceof Error ? error.message : String(error))
          }
        }
        return
      }
      await setGlobalModels({
        ...next,
        globalGraphProviderId: providerId,
        globalGraphModelId: modelId
      })
    },
    [dialog, onError, setGlobalModels]
  )

  const selectModel = useCallback(
    async (providerId: string, modelId: string) => {
      if (!picker) return
      if (picker.field === 'vision') {
        setVisionProviderId(providerId)
        setVisionModelId(modelId)
        if (picker.persistVision) {
          try {
            await persistVision(providerId, modelId)
          } catch (error) {
            onError(error instanceof Error ? error.message : String(error))
          }
        }
        setPicker(null)
        return
      }
      await applyGlobalModel(picker.field, providerId, modelId)
      setPicker(null)
    },
    [applyGlobalModel, onError, persistVision, picker, setVisionModelId, setVisionProviderId]
  )

  return {
    picker,
    closePicker,
    pickStatusRow,
    openVisionPicker,
    selectModel
  }
}
