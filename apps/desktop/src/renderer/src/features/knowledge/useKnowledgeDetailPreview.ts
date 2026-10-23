import { useState } from 'react'
import { collectNotebookGraphSourceWindows } from '@baishou/shared'
import { callKnowledgeApi } from './call-knowledge-api'
import type { KnowledgeVectorChunkCard } from './KnowledgeVectorPane'
import type { SourcePreviewPayload } from './KnowledgeSourcePreviewDialog'
import type { KnowledgeSourceRow } from './knowledge-detail.types'
import {
  buildGraphFragmentItems,
  buildVectorFragmentItem,
  type KnowledgeSourceFragment
} from './knowledge-source-fragment.util'
import type { NotebookGraphViewEdge } from './notebook-graph-view.util'

export function useKnowledgeDetailPreview(notebookId: string) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewPayload, setPreviewPayload] = useState<SourcePreviewPayload | null>(null)
  const [fragmentOpen, setFragmentOpen] = useState(false)
  const [fragmentLoading, setFragmentLoading] = useState(false)
  const [fragmentError, setFragmentError] = useState<string | null>(null)
  const [fragments, setFragments] = useState<KnowledgeSourceFragment[]>([])

  const onPreview = async (source: KnowledgeSourceRow) => {
    setPreviewOpen(true)
    setPreviewTitle(source.title)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewPayload(null)
    try {
      const result = await callKnowledgeApi<SourcePreviewPayload>(
        'getSourceFile',
        'knowledge:get-source-file',
        { sourceId: source.id }
      )
      setPreviewPayload(result)
    } catch (e: any) {
      setPreviewError(String(e?.message || e))
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewPayload(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  const closeFragments = () => {
    setFragmentOpen(false)
    setFragments([])
    setFragmentError(null)
    setFragmentLoading(false)
  }

  const onPreviewGraphFragments = async (edges: NotebookGraphViewEdge[]) => {
    const windows = collectNotebookGraphSourceWindows(edges)
    setFragmentOpen(true)
    setFragmentError(null)
    if (windows.length === 0) {
      setFragments([])
      setFragmentLoading(false)
      return
    }
    setFragmentLoading(true)
    setFragments([])
    try {
      const result = await callKnowledgeApi<{
        items: Array<{
          sourceId: string
          sourceTitle: string
          windowIndex: number
          text: string | null
        }>
      }>('getExtractedWindows', 'knowledge:get-extracted-windows', {
        notebookId,
        windows: windows.map((row) => ({
          sourceId: row.sourceId,
          windowIndex: row.windowIndex
        }))
      })
      setFragments(buildGraphFragmentItems(windows, result.items || []))
    } catch (e: unknown) {
      setFragmentError(String((e as Error)?.message || e))
    } finally {
      setFragmentLoading(false)
    }
  }

  const onPreviewVectorFragment = (item: KnowledgeVectorChunkCard) => {
    setFragmentOpen(true)
    setFragmentLoading(false)
    setFragmentError(null)
    setFragments([buildVectorFragmentItem(item)])
  }

  return {
    previewOpen,
    previewTitle,
    previewLoading,
    previewError,
    previewPayload,
    fragmentOpen,
    fragmentLoading,
    fragmentError,
    fragments,
    onPreview,
    closePreview,
    closeFragments,
    onPreviewGraphFragments,
    onPreviewVectorFragment
  }
}
