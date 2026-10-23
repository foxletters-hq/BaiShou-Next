import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { Button, Input, MarkdownRenderer } from '@baishou/ui'
import { assessFetchedWebPage, fetchedWebPageIssueMessage } from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import {
  buildPdfJsDocumentParams,
  parsePdfPreviewPageJump,
  pdfBookSpreadPages,
  pdfSpreadStep,
  resolvePdfPreviewFitScale,
  resolvePdfPreviewPageCssSize,
  resolvePdfPreviewSource,
  stepPdfPreviewScale,
  type PdfPreviewSource
} from './knowledge-source-preview.util'
import { EpubSourcePreview } from './EpubSourcePreview'
import styles from './KnowledgePage.module.css'

export type SourcePreviewPayload = {
  kind: 'pdf' | 'epub' | 'text' | 'url' | 'unsupported'
  fileName: string
  localUrl: string | null
  fileBytes?: Uint8Array | ArrayBuffer | null
  textContent: string | null
  pages?: string[] | null
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
  viewportScale: number,
  isCancelled: () => boolean
): Promise<{ promise: Promise<void>; cancel?: () => void } | null> {
  const pdfPage = await doc.getPage(pageNumber)
  if (isCancelled()) return null
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
  const [lockedScale, setLockedScale] = useState<number | null>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [pageDraft, setPageDraft] = useState('1')
  const renderTasksRef = useRef<Array<{ cancel?: () => void }>>([])
  const sourceRef = useRef(source)
  sourceRef.current = source
  const sourceKey = source.type === 'url' ? source.url : source.data
  const visiblePages = pdfBookSpreadPages(page, pageCount)

  useEffect(() => {
    setPageDraft(String(page))
  }, [page])

  const commitPageJump = () => {
    const next = parsePdfPreviewPageJump(pageDraft, pageCount)
    if (next == null) {
      setPageDraft(String(page))
      return
    }
    setPage(next)
  }

  useEffect(() => {
    let cancelled = false
    let loaded: PdfDoc | null = null
    setStatus('loading')
    setError('')
    setPage(1)
    setPageCount(0)
    setDoc(null)
    setLockedScale(null)
    setDisplayScale(1)
    setViewport({ width: 0, height: 0 })

    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const next = await pdfjs.getDocument(buildPdfJsDocumentParams(sourceRef.current)).promise
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
    const syncViewport = () => {
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      setViewport((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      )
    }
    syncViewport()
    const observer = new ResizeObserver(syncViewport)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [doc, status])

  useEffect(() => {
    if (status !== 'ready') return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPage((current) => pdfSpreadStep(current, pageCount, -1))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setPage((current) => pdfSpreadStep(current, pageCount, 1))
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setLockedScale((current) => stepPdfPreviewScale(current ?? displayScale, 1))
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setLockedScale((current) => stepPdfPreviewScale(current ?? displayScale, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [displayScale, pageCount, status])

  useEffect(() => {
    if (
      viewport.width <= 0 ||
      viewport.height <= 0 ||
      !doc ||
      status !== 'ready' ||
      !wrapRef.current
    )
      return
    let cancelled = false
    const pages = pdfBookSpreadPages(page, pageCount)
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
        const fitScale = resolvePdfPreviewFitScale({
          pageWidth: base.width,
          pageHeight: base.height,
          pageCountInView: pages.length,
          availableWidth: Math.max(80, viewport.width - 32),
          availableHeight: Math.max(80, viewport.height - 32),
          spreadSlot: true,
          fit: 'page'
        })
        const scale = lockedScale ?? fitScale
        const size = resolvePdfPreviewPageCssSize({
          pageWidth: base.width,
          pageHeight: base.height,
          pageCountInView: pages.length,
          availableWidth: Math.max(80, viewport.width - 32),
          availableHeight: Math.max(80, viewport.height - 32),
          spreadSlot: true,
          scale
        })
        if (!cancelled) setDisplayScale(size.viewportScale)
        for (let i = 0; i < pages.length; i += 1) {
          const canvas = canvases[i]
          const pageNumber = pages[i]
          if (!canvas || !pageNumber) continue
          const pdfPage = await doc.getPage(pageNumber)
          if (cancelled) return
          const pageBase = pdfPage.getViewport({ scale: 1 })
          const task = await renderPdfPageToCanvas(
            doc,
            pageNumber,
            canvas,
            pageBase.width * size.viewportScale,
            pageBase.height * size.viewportScale,
            size.viewportScale,
            () => cancelled
          )
          if (!task || cancelled) {
            task?.cancel?.()
            return
          }
          renderTasksRef.current.push(task)
          await task.promise
          if (cancelled) return
        }
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        if (!/cancel/i.test(message)) setError(message)
      }
    })()

    return () => {
      cancelled = true
      for (const task of renderTasksRef.current) task.cancel?.()
      renderTasksRef.current = []
    }
  }, [doc, lockedScale, page, pageCount, status, viewport.height, viewport.width])

  if (status === 'loading') {
    return (
      <div className={styles.previewStatus}>{t('knowledge.preview_loading', '正在加载预览…')}</div>
    )
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
        <div className={styles.pdfToolbarGroup}>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.pdfIconBtn}
            disabled={page <= 1}
            onClick={() => setPage((current) => pdfSpreadStep(current, pageCount, -1))}
            aria-label={t('knowledge.preview_prev_page', '上一页')}
          >
            <ChevronLeft size={16} />
          </Button>
          <Input
            fieldSize="small"
            inputMode="numeric"
            value={pageDraft}
            aria-label={t('knowledge.preview_jump_page', '跳转到页')}
            className={styles.pdfPageJump}
            inputClassName={styles.pdfPageJumpField}
            onChange={(event) => setPageDraft(event.target.value)}
            onBlur={commitPageJump}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              commitPageJump()
            }}
          />
          <span className={styles.pdfPageLabel}>
            {t('knowledge.preview_page_total', '/ {{total}}', { total: pageCount })}
          </span>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.pdfIconBtn}
            disabled={(visiblePages[visiblePages.length - 1] ?? page) >= pageCount}
            onClick={() => setPage((current) => pdfSpreadStep(current, pageCount, 1))}
            aria-label={t('knowledge.preview_next_page', '下一页')}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className={styles.pdfToolbarDivider} aria-hidden />
        <div className={styles.pdfToolbarGroup}>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.pdfIconBtn}
            disabled={displayScale <= 0.25}
            onClick={() => setLockedScale(stepPdfPreviewScale(displayScale, -1))}
            aria-label={t('knowledge.preview_zoom_out', '缩小')}
          >
            <Minus size={16} />
          </Button>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.pdfZoomLabel}
            onClick={() => setLockedScale(1)}
            aria-label={t('knowledge.preview_zoom_reset', '恢复 100%')}
          >
            {t('knowledge.preview_zoom_percent', '{{percent}}%', {
              percent: Math.round(displayScale * 100)
            })}
          </Button>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.pdfIconBtn}
            disabled={displayScale >= 4}
            onClick={() => setLockedScale(stepPdfPreviewScale(displayScale, 1))}
            aria-label={t('knowledge.preview_zoom_in', '放大')}
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>
      <div ref={wrapRef} className={styles.pdfCanvasWrap}>
        <div className={visiblePages.length > 1 ? styles.pdfSpread : styles.pdfSingle}>
          <canvas ref={leftCanvasRef} className={styles.pdfCanvas} />
          {visiblePages.length > 1 ? (
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
      animation="none"
      title={
        <div className={styles.previewTitleRow}>
          <span className={styles.previewHeading} title={title}>
            {title}
          </span>
          <Button
            type="button"
            size="small"
            variant="text"
            className={styles.previewCloseBtn}
            onClick={onClose}
            aria-label={t('common.close', '关闭')}
          >
            <X size={16} strokeWidth={2} />
          </Button>
        </div>
      }
      aria-label={t('knowledge.preview_source_title', '源文件预览')}
      className={styles.previewDialog}
    >
      {loading ? (
        <div className={styles.previewStatus}>
          {t('knowledge.preview_loading', '正在加载预览…')}
        </div>
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
      {!loading && !error && payload?.kind === 'epub' ? (
        <EpubSourcePreview pages={payload.pages ?? []} />
      ) : null}
      {!loading && !error && (payload?.kind === 'text' || payload?.kind === 'url') ? (
        <UrlOrTextPreview payload={payload} />
      ) : null}
      {!loading && !error && payload?.kind === 'unsupported' ? (
        <div className={styles.previewStatus}>
          {t('knowledge.preview_unsupported', '暂不支持预览该类型文件')}
        </div>
      ) : null}
    </KnowledgeDialog>
  )
}
