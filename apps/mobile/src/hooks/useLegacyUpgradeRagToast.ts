import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY,
  LEGACY_UPGRADE_RAG_NOTICE_MAX
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'

import { useBaishou } from '../providers/BaishouProvider'

export function useLegacyUpgradeRagToast(): void {
  const toast = useNativeToast()
  const { t } = useTranslation()
  const { dbReady, legacyRagReembedRequired, services } = useBaishou()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!dbReady || !legacyRagReembedRequired || checkedRef.current) return
    checkedRef.current = true

    void (async () => {
      const settingsManager = services?.settingsManager
      if (!settingsManager) return

      const shownCount =
        (await settingsManager.get<number>(LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never)) ?? 0
      if (shownCount >= LEGACY_UPGRADE_RAG_NOTICE_MAX) return

      await settingsManager.set(
        LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never,
        (shownCount + 1) as never
      )

      toast.showWarning(
        t(
          'settings.legacy_upgrade_rag_notice',
          '已从旧版继承日记、总结和 AI 伙伴。RAG 记忆需要重新嵌入，请前往 设置 → RAG 记忆 执行全量扫描。'
        )
      )
    })()
  }, [dbReady, legacyRagReembedRequired, services, t, toast])
}
