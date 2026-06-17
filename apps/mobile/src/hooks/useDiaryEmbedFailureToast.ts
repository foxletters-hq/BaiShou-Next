import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isRagMemoryEnabled } from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'

import { useBaishou } from '../providers/BaishouProvider'
import { subscribeDiaryEmbedFailure } from '../services/mobile-diary-embedding.service'

const DIARY_EMBED_FAILURE_TOAST_DEBOUNCE_MS = 8000

export function useDiaryEmbedFailureToast(): void {
  const toast = useNativeToast()
  const { t } = useTranslation()
  const { services } = useBaishou()
  const lastShownAtRef = useRef(0)

  useEffect(() => {
    return subscribeDiaryEmbedFailure(() => {
      void (async () => {
        const settingsManager = services?.settingsManager
        if (!settingsManager) return

        const ragConfig = (await settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
        if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) return

        const now = Date.now()
        if (now - lastShownAtRef.current < DIARY_EMBED_FAILURE_TOAST_DEBOUNCE_MS) return
        lastShownAtRef.current = now

        toast.showWarning(
          t(
            'settings.rag_diary_auto_embed_failed',
            '日记已保存，但记忆嵌入未成功。请前往 设置 → RAG 记忆，点击「全量扫描未索引日记」补全嵌入。'
          )
        )
      })()
    })
  }, [t, toast, services])
}
