import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseDateStr } from '@baishou/shared'
import type { useNativeToast } from '@baishou/ui/native'
import type { useBaishou } from '@/src/providers/BaishouProvider'
import { parseGraphSourceDate } from './graph-screen-derive.util'
import type { GraphSourcePreview } from './graph-screen.types'

type GraphScreenSourcePreviewOptions = {
  services: ReturnType<typeof useBaishou>['services']
  toast: ReturnType<typeof useNativeToast>
}

/** 原文预览状态与加载逻辑 */
export function useGraphScreenSourcePreview(opts: GraphScreenSourcePreviewOptions) {
  const { t } = useTranslation()
  const [sourcePreview, setSourcePreview] = useState<GraphSourcePreview | null>(null)
  const { services, toast } = opts

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const { raw, date } = parseGraphSourceDate(dateOrRef)
    const excerpt = String(fallbackExcerpt || '').trim()
    if (!date && !excerpt && !raw) {
      toast.showInfo(t('graph.source_unavailable', '没有可预览的原文'))
      return
    }
    setSourcePreview({
      date,
      content: excerpt || '',
      excerpt: excerpt || null,
      loading: Boolean(date)
    })
    if (!date) {
      setSourcePreview({
        date: null,
        content: excerpt || raw,
        excerpt: excerpt || null,
        loading: false
      })
      return
    }
    if (!services?.diaryService) {
      setSourcePreview({
        date,
        content: excerpt || t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
      return
    }
    try {
      const entry = await services.diaryService.findByDate(parseDateStr(date))
      const content = String(entry?.content || '').trim() || excerpt
      setSourcePreview({
        date,
        content: content || t('graph.source_not_found', '未找到该日日记原文'),
        excerpt: excerpt || null,
        loading: false
      })
    } catch (e: any) {
      setSourcePreview({
        date,
        content:
          excerpt || String(e?.message || e) || t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
    }
  }

  return { sourcePreview, setSourcePreview, openSource }
}
