import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LEGACY_UPGRADE_RAG_NOTICE_MAX } from '@baishou/shared'
import { useToast } from '@baishou/ui'

export function useLegacyUpgradeRagToast(): void {
  const toast = useToast()
  const { t } = useTranslation()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    void (async () => {
      const api = window.api?.settings
      if (!api?.getLegacyUpgradeNoticeState || !api?.markLegacyUpgradeNoticeShown) return

      try {
        const state = await api.getLegacyUpgradeNoticeState()
        if (!state?.pending || (state.shownCount ?? 0) >= LEGACY_UPGRADE_RAG_NOTICE_MAX) return

        await api.markLegacyUpgradeNoticeShown()
        toast.showWarning(
          t(
            'settings.legacy_upgrade_rag_notice',
            '已从旧版继承日记、总结和 AI 伙伴。RAG 记忆需要重新嵌入，请前往 设置 → RAG 记忆 执行全量扫描。'
          ),
          { duration: 8000 }
        )
      } catch {
        // non-critical
      }
    })()
  }, [t, toast])
}
