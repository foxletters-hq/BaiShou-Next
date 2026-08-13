import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KnowledgeDialog } from './KnowledgeDialog'
import styles from './KnowledgePage.module.css'

export type SourcePreviewPayload = {
  kind: 'pdf' | 'text' | 'url' | 'unsupported'
  fileName: string
  localUrl: string | null
  textContent: string | null
  originUrl: string | null
}

type Props = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  payload: SourcePreviewPayload | null
  onClose: () => void
}

type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number }
    render: (opts: {
      canvasContext: CanvasRenderingContext2D
      viewport: { width: number; height: number }
    }) => { promise: Promise<void>; cancel?: () => void }
  }>
  destroy?: () => Promise<void>
}

let pdfjsModulePromise: Promise<{
  getDocument: (src: unknown) => { promise: Promise<PdfDoc> }
  GlobalWorkerOptions: { workerSrc: string }
}> | null = null

async function loadPdfJs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs as unknown as {
        getDocument: (src: unknown) => { promise: Promise<PdfDoc> }
        GlobalWorkerOptions: { workerSrc: string }
      }
    })()
  }
  return pdfjsModulePromise
}

const PdfPageViewer: React.FC<{ localUrl: string }> = ({ localUrl }) => {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: PdfDoc | null = null
    setStatus('loading')
    setError('')
    setPage(1)
    setPageCount(0)
    setDoc(null)

    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const response = await fetch(localUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = new Uint8Array(await response.arrayBuffer())
        const next = await pdfjs.getDocument({ data }).promise
        if (cancelled) {
          await next.destroy?.()
          return
        }
        loaded = next
        setDoc(next)
        setPageCount(next.numPages)
        setStatus('ready')
      } catch (e: unknown) {
        if (cancelled) return
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel?.()
      void loaded?.destroy?.()
    }
  }, [localUrl])

  useEffect(() => {
    if (!doc || !canvasRef.current || status !== 'ready') return
    let cancelled = false
    const canvas = canvasRef.current

    void (async () => {
      try {
        renderTaskRef.current?.cancel?.()
        const pdfPage = await doc.getPage(page)
        if (cancelled) return
        const containerWidth = canvas.parentElement?.clientWidth || 640
        const base = pdfPage.getViewport({ scale: 1 })
        const scale = Math.min(1.6, Math.max(0.8, (containerWidth - 16) / base.width))
        const viewport = pdfPage.getViewport({ scale })
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const task = pdfPage.render({ canvasContext: context, viewport })
        renderTaskRef.current = task
        await task.promise
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        if (!/cancel/i.test(message)) setError(message)
      }
    })()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel?.()
    }
  }, [doc, page, status])

  if (status === 'loading') {
    return <div className={styles.previewStatus}>{t('knowledge.preview_loading', '正在加载预览…')}</div>
  }
  if (status === 'error') {
    return (
      <div className={styles.previewStatus}>
        {t('knowledge.preview_failed', '预览失败')}
        {error ? `：${error}` : ''}
      </div>
    )
  }

  return (
    <div className={styles.pdfPreview}>
      <div className={styles.pdfToolbar}>
        <button
          type="button"
          className={styles.pdfNavBtn}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label={t('knowledge.preview_prev_page', '上一页')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pdfPageLabel}>
          {t('knowledge.preview_page_of', '{{page}} / {{total}}', { page, total: pageCount })}
        </span>
        <button
          type="button"
          className={styles.pdfNavBtn}
          disabled={page >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          aria-label={t('knowledge.preview_next_page', '下一页')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className={styles.pdfCanvasWrap}>
        <canvas ref={canvasRef} className={styles.pdfCanvas} />
      </div>
      {error ? <p className={styles.metaLine}>{error}</p> : null}
    </div>
  )
}

export const KnowledgeSourcePreviewDialog: React.FC<Props> = ({
  open,
  title,
  loading,
  error,
  payload,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <KnowledgeDialog
      open={open}
      onClose={onClose}
      title={title}
      aria-label={t('knowledge.preview_source_title', '源文件预览')}
      className={styles.previewDialog}
    >
      {loading ? (
        <div className={styles.previewStatus}>{t('knowledge.preview_loading', '正在加载预览…')}</div>
      ) : null}
      {!loading && error ? <div className={styles.previewStatus}>{error}</div> : null}
      {!loading && !error && payload?.kind === 'pdf' && payload.localUrl ? (
        <PdfPageViewer localUrl={payload.localUrl} />
      ) : null}
      {!loading && !error && (payload?.kind === 'text' || payload?.kind === 'url') ? (
        <div className={styles.previewBox}>
          {payload.originUrl ? (
            <p className={styles.metaLine}>{payload.originUrl}</p>
          ) : null}
          {payload.textContent?.trim()
            ? payload.textContent
            : t('knowledge.preview_empty', '暂无提取正文')}
        </div>
      ) : null}
      {!loading && !error && payload?.kind === 'unsupported' ? (
        <div className={styles.previewStatus}>
          {t('knowledge.preview_unsupported', '暂不支持预览该类型文件')}
        </div>
      ) : null}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.btnPrimary} onClick={onClose}>
          {t('common.close', '关闭')}
        </button>
      </div>
    </KnowledgeDialog>
  )
}
