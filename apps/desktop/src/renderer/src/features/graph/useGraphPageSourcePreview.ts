import { useEffect, useState } from 'react'
import { parseGraphSourceDate } from './graph-page-derive.util'
import type { GraphSourcePreview } from './graph-page.types'

type SourceDeps = {
  t: (key: string, defaultValue?: string) => string
  toast: { showInfo: (message: string) => void; showError: (message: string) => void }
}

export function useGraphPageSourcePreview(deps: SourceDeps) {
  const [sourcePreview, setSourcePreview] = useState<GraphSourcePreview | null>(null)

  useEffect(() => {
    if (!sourcePreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSourcePreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sourcePreview])

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const { raw, date } = parseGraphSourceDate(dateOrRef)
    const excerpt = String(fallbackExcerpt || '').trim()

    if (!date && !excerpt && !raw) {
      deps.toast.showInfo(deps.t('graph.source_unavailable', '没有可预览的原文'))
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

    try {
      const [entry, attachmentDir] = await Promise.all([
        window.api.diary.findByDate(date),
        window.api.diary.getAttachmentDir?.(date).catch(() => '') ?? Promise.resolve('')
      ])
      const content =
        String((entry as { content?: string } | null)?.content || '').trim() || excerpt
      setSourcePreview({
        date,
        content: content || deps.t('graph.source_not_found', '未找到该日日记原文'),
        excerpt: excerpt || null,
        basePath: attachmentDir || undefined,
        loading: false
      })
    } catch (e: any) {
      setSourcePreview({
        date,
        content: excerpt || e?.message || deps.t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
      if (!excerpt)
        deps.toast.showError(e?.message || deps.t('graph.source_load_failed', '加载原文失败'))
    }
  }

  return { sourcePreview, setSourcePreview, openSource }
}
