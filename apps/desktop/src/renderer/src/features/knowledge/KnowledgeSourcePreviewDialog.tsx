import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MarkdownRenderer } from '@baishou/ui'
import {
  assessFetchedWebPage,
  fetchedWebPageIssueMessage
} from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import {
  buildPdfJsDocumentParams,
  formatPdfPreviewPageLabel,
  pdfBookSpreadPages,
  pdfSpreadStep,
  resolvePdfPreviewPageCssSize,
  resolvePdfPreviewSource,
  shouldUsePdfBookSpread,
  type PdfPreviewSource
} from './knowledge-source-preview.util'
import styles from './KnowledgePage.module.css'

export type SourcePreviewPayload = {
  kind: 'pdf' | 'text' | 'url' | 'unsupported'
  fileName: string
  localUrl: string | null
  fileBytes?: Uint8Array | ArrayBuffer | null
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
      transform?: number[]
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

async function renderPdfPageToCanvas(
  doc: PdfDoc,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  viewportScale: number
): Promise<{ cancel?: () => void }> {
  const pdfPage = await doc.getPage(pageNumber)
  const outputScale = window.devicePixelRatio || 1
  const viewport = pdfPage.getViewport({ scale: viewportScale })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d unavailable')
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(cssWidth)}px`
  canvas.style.height = `${Math.floor(cssHeight)}px`
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
  const task = pdfPage.render({
    canvasContext: context,
    viewport,
    ...(transform ? { transform } : {})
  })
  await task.promise
  return task
}

const PdfPageViewer: React.FC<{ source: PdfPreviewSource }> = ({ source }) => {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const leftCanvasRef = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [useSpread, setUseSpread] = useState(false)
  const renderTasksRef = useRef<Array<{ cancel?: () => void }>>([])
  const sourceKey = source.type === 'url' ? source.url : source.data
  const visiblePages = useSpread ? pdfBookSpreadPages(page, pageCount) : [page]
  const pageLabel = formatPdfPreviewPageLabel(visiblePages, pageCount)

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
        const next = await pdfjs.getDocument(buildPdfJsDocumentParams(source)).promise
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
      for (const task of renderTasksRef.current) task.cancel?.()
      void loaded?.destroy?.()
    }
    // sourceKey 相同表示同一份文件，避免父组件重建对象时重复打开。
  }, [sourceKey])

  useEffect(() => {
    if (!doc || status !== 'ready' || !wrapRef.current) return
    const wrap = wrapRef.current
    const syncSpread = () => {
      const width = wrap.clientWidth
      void (async () => {
        try {
          const probe = await doc.getPage(page)
          const base = probe.getViewport({ scale: 1 })
          setUseSpread(shouldUsePdfBookSpread(width, base.width) && doc.numPages > 1)
        } catch {
          setUseSpread(false)
        }
      })()
    }
    syncSpread()
    const observer = new ResizeObserver(syncSpread)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [doc, page, status])

  useEffect(() => {
    if (!doc || status !== 'ready' || !wrapRef.current) return
    let cancelled = false
    const wrap = wrapRef.current
    const pages = useSpread ? pdfBookSpreadPages(page, pageCount) : [page]
    const canvases = [leftCanvasRef.current, rightCanvasRef.current].filter(
      Boolean
    ) as HTMLCanvasElement[]

    void (async () => {
      try {
        for (const task of renderTasksRef.current) task.cancel?.()
        renderTasksRef.current = []
        const first = await doc.getPage(pages[0] ?? 1)
        if (cancelled) return
        const base = first.getViewport({ scale: 1 })
        const size = resolvePdfPreviewPageCssSize({
          pageWidth: base.width,
          pageHeight: base.height,
          pageCountInView: pages.length,
          availableWidth: Math.max(80, wrap.clientWidth - 16)
        })
        const tasks: Array<{ cancel?: () => void }> = []
        for (let i = 0; i < pages.length; i += 1) {
          const canvas = canvases[i]
          const pageNumber = pages[i]
          if (!canvas || !pageNumber) continue
          const task = await renderPdfPageToCanvas(
            doc,
            pageNumber,
            canvas,
            size.cssWidth,
            size.cssHeight,
            size.viewportScale
          )
          if (cancelled) {
            task.cancel?.()
            return
          }
          tasks.push(task)
        }
        renderTasksRef.current = tasks
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        if (!/cancel/i.test(message)) setError(message)
      }
    })()

    return () => {
      cancelled = true
      for (const task of renderTasksRef.current) task.cancel?.()
    }
  }, [doc, page, pageCount, status, useSpread])

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
          onClick={() =>
            setPage((current) =>
              useSpread ? pdfSpreadStep(current, pageCount, -1) : Math.max(1, current - 1)
            )
          }
          aria-label={t('knowledge.preview_prev_page', '上一页')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pdfPageLabel}>
          {t('knowledge.preview_page_of', '{{page}} / {{total}}', {
            page: pageLabel.page,
            total: pageLabel.total
          })}
        </span>
        <button
          type="button"
          className={styles.pdfNavBtn}
          disabled={(visiblePages[visiblePages.length - 1] ?? page) >= pageCount}
          onClick={() =>
            setPage((current) =>
              useSpread ? pdfSpreadStep(current, pageCount, 1) : Math.min(pageCount, current + 1)
            )
          }
          aria-label={t('knowledge.preview_next_page', '下一页')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div ref={wrapRef} className={styles.pdfCanvasWrap}>
        <div className={useSpread && visiblePages.length > 1 ? styles.pdfSpread : styles.pdfSingle}>
          <canvas ref={leftCanvasRef} className={styles.pdfCanvas} />
          {useSpread && visiblePages.length > 1 ? (
            <canvas ref={rightCanvasRef} className={styles.pdfCanvas} />
          ) : null}
        </div>
      </div>
      {error ? <p className={styles.metaLine}>{error}</p> : null}
    </div>
  )
}

const UrlOrTextPreview: React.FC<{ payload: SourcePreviewPayload }> = ({ payload }) => {
  const { t } = useTranslation()
  const text = payload.textContent?.trim() || ''
  const quality = assessFetchedWebPage({
    requestedUrl: payload.originUrl || undefined,
    finalUrl: payload.originUrl || undefined,
    markdown: text
  })
  const issueText = fetchedWebPageIssueMessage(quality.issue)

  return (
    <div className={styles.previewStack}>
      {payload.originUrl ? (
        <button
          type="button"
          className={styles.previewOriginLink}
          onClick={() => void window.api.shell.openExternal(payload.originUrl!)}
        >
          {payload.originUrl}
        </button>
      ) : null}
      {!quality.usable && issueText ? <p className={styles.previewWarn}>{issueText}</p> : null}
      {text ? (
        <div className={styles.previewMarkdown}>
          <MarkdownRenderer content={text} />
        </div>
      ) : (
        <div className={styles.previewBox}>{t('knowledge.preview_empty', '暂无提取正文')}</div>
      )}
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
  const pdfSource = useMemo(
    () => (payload?.kind === 'pdf' ? resolvePdfPreviewSource(payload) : null),
    [payload]
  )

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
      {!loading && !error && payload?.kind === 'pdf' && pdfSource ? (
        <PdfPageViewer source={pdfSource} />
      ) : null}
      {!loading && !error && payload?.kind === 'pdf' && !pdfSource ? (
        <div className={styles.previewStatus}>
          {t('knowledge.preview_failed_read_source', '预览失败：无法读取源文件')}
        </div>
      ) : null}
      {!loading && !error && (payload?.kind === 'text' || payload?.kind === 'url') ? (
        <UrlOrTextPreview payload={payload} />
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
