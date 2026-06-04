import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import type { TFunction } from 'i18next'
import { classifyAiApiCallError, formatAiApiCallError } from '@baishou/shared'
import type { MobileRagService, RagProgressCallback } from '../services/mobile-rag.service'
import type { RagState } from '@baishou/ui/native'

function localizeRagEmbedError(raw: string, t: TFunction): string {
  const kind = classifyAiApiCallError({ message: raw, responseBody: raw })
  switch (kind) {
    case 'balance':
      return t('agent.error.quota')
    case 'auth':
      return t('ai_config.error_no_model')
    case 'rate_limit':
      return t('agent.error.rate_limit')
    case 'network':
      return t('agent.error.network')
    default:
      return raw
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^(Batch embed failed|Re-embed failed):\s*/i, '')
  }
  return formatAiApiCallError(error)
}

const idleRagState = (): RagState => ({
  isRunning: false,
  type: 'idle',
  progress: 0,
  total: 0,
  statusText: ''
})

export function useMobileRagSystem(ragService: MobileRagService | undefined) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const [hasMismatchModel, setHasMismatchModel] = useState(false)
  const [ragState, setRagState] = useState<RagState>(idleRagState())

  const checkModelMismatch = useCallback(async () => {
    if (!ragService) return false
    const mismatch = await ragService.hasModelMismatch()
    setHasMismatchModel(mismatch)
    return mismatch
  }, [ragService])

  const mapProgress = useCallback(
    (p: Parameters<RagProgressCallback>[0]): RagState => ({
      isRunning: true,
      type: 'reembed',
      progress: p.current,
      total: p.total,
      statusText:
        p.status === 'detect-dimension'
          ? t('settings.rag_migration_detecting_dimension')
          : p.status || t('settings.rag_migration_reembedding')
    }),
    [t]
  )

  const handleReembedAfterModelChange = useCallback(async (): Promise<boolean> => {
    if (!ragService) return false

    const confirmed = await dialog.confirm(
      `${t('settings.rag_model_mismatch_desc')}\n\n${t('settings.rag_trigger_migration')}?`,
      { confirmText: t('settings.rag_trigger_migration') }
    )
    if (!confirmed) return false

    setRagState({ ...idleRagState(), isRunning: true, type: 'reembed', statusText: '' })
    try {
      const count = await ragService.reembedAll((p) => {
        setRagState(mapProgress(p))
      })
      setHasMismatchModel(false)
      setRagState(idleRagState())
      toast.showSuccess(
        count > 0
          ? t('settings.rag_batch_embed_done', { count: String(count) })
          : t('settings.rag_migration_complete')
      )
      return true
    } catch (e: unknown) {
      const detail = localizeRagEmbedError(extractErrorMessage(e), t)
      setRagState({
        ...idleRagState(),
        error: detail
      })
      toast.showError(t('settings.rag_migration_failed', { message: detail }))
      return false
    }
  }, [dialog, ragService, t, mapProgress, toast])

  return {
    hasMismatchModel,
    ragState,
    setRagState,
    checkModelMismatch,
    handleReembedAfterModelChange
  }
}
