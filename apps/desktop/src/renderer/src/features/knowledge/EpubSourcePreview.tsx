import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input, MarkdownRenderer } from '@baishou/ui'
import { parsePdfPreviewPageJump } from './knowledge-source-preview.util'
import {
  EPUB_PREVIEW_COLUMN_GAP_FALLBACK,
  clampEpubPreviewPage,
  epubPreviewColumnLayout,
  epubPreviewPageCount,
  epubPreviewPageOffset,
  joinEpubPreviewText,
  readEpubPreviewColumnGap
} from './epub-preview.util'
import styles from './KnowledgePage.module.css'

const WHEEL_TURN_GAP_MS = 320

type PreviewBox = { width: number; height: number; gap: number; dpr: number }

const EMPTY_BOX: PreviewBox = {
  width: 0,
  height: 0,
  gap: EPUB_PREVIEW_COLUMN_GAP_FALLBACK,
  dpr: 1
}

/** 正文只跟文本走。翻页如果让它重渲染，整本书的 Markdown 会再解析一遍。 */
const EpubPreviewBody = React.memo(function EpubPreviewBody({ text }: { text: string }) {
  return <MarkdownRenderer content={text} />
})

export const EpubSourcePreview: React.FC<{ pages: string[] }> = ({ pages }) => {
  const { t } = useTranslation()
  const text = useMemo(() => joinEpubPreviewText(pages), [pages])
  const viewportRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const wheelAtRef = useRef(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [pageDraft, setPageDraft] = useState('1')
  const [box, setBox] = useState<PreviewBox>(EMPTY_BOX)
  const [trackedText, setTrackedText] = useState(text)

  if (trackedText !== text) {
    setTrackedText(text)
    setPage(1)
    setPageCount(1)
    setPageDraft('1')
    setBox(EMPTY_BOX)
  }

  const layout = epubPreviewColumnLayout(box.width, box.gap, box.dpr)
  const current = clampEpubPreviewPage(page, pageCount)
  const pageOffset = epubPreviewPageOffset(current, layout.stride, box.dpr)

  useEffect(() => {
    setPageDraft((draft) => {
      const next = String(current)
      return draft === next ? draft : next
    })
  }, [current])

  const commitPageJump = () => {
    const next = parsePdfPreviewPageJump(pageDraft, pageCount)
    if (next == null) {
      setPageDraft(String(current))
      return
    }
    setPage(next)
    setPageDraft(String(next))
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !text) return
    const measure = () => {
      const rectWidth = viewport.getBoundingClientRect().width
      const width = rectWidth > 0 ? rectWidth : viewport.clientWidth
      const height = viewport.clientHeight
      const gap = readEpubPreviewColumnGap(viewport)
      const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
      setBox((prev) =>
        prev.width === width && prev.height === height && prev.gap === gap && prev.dpr === dpr
          ? prev
          : { width, height, gap, dpr }
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [text])

  useLayoutEffect(() => {
    const flow = flowRef.current
    if (!flow || layout.stride <= 0) return
    // 栏宽写上之后再量横向溢出，屏数才跟预览框高度对齐。
    const applyCount = () => {
      const count = epubPreviewPageCount(flow.scrollWidth, layout.stride)
      setPageCount((prev) => (prev === count ? prev : count))
      setPage((currentPage) => {
        const next = clampEpubPreviewPage(currentPage, count)
        return next === currentPage ? currentPage : next
      })
    }
    applyCount()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(applyCount)
    observer.observe(flow)
    return () => observer.disconnect()
  }, [layout.columnWidth, layout.stride, box.height, text])

  useEffect(() => {
    if (!text || pageCount < 1) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const delta = event.key === 'ArrowLeft' ? -1 : 1
      setPage((currentPage) => clampEpubPreviewPage(currentPage + delta, pageCount))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageCount, text])

  const turn = (delta: -1 | 1) => {
    setPage((currentPage) => clampEpubPreviewPage(currentPage + delta, pageCount))
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < 12) return
    const now = Date.now()
    if (now - wheelAtRef.current < WHEEL_TURN_GAP_MS) return
    wheelAtRef.current = now
    turn(delta > 0 ? 1 : -1)
  }

  if (!text) {
    return <div className={styles.previewBox}>{t('knowledge.preview_empty', '暂无提取正文')}</div>
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
            disabled={current <= 1}
            onClick={() => turn(-1)}
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
            disabled={current >= pageCount}
            onClick={() => turn(1)}
            aria-label={t('knowledge.preview_next_page', '下一页')}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={styles.epubViewport}
        data-testid="epub-viewport"
        onWheel={onWheel}
      >
        <div
          className={styles.epubClip}
          style={{ width: layout.stride > 0 ? layout.stride : '100%' }}
        >
          <div
            className={styles.epubShift}
            data-testid="epub-shift"
            style={{ transform: `translate3d(${-pageOffset}px, 0, 0)` }}
          >
            <div
              ref={flowRef}
              className={styles.epubFlow}
              data-testid="epub-flow"
              style={{
                columnWidth: layout.columnWidth > 0 ? `${layout.columnWidth}px` : undefined,
                columnGap: layout.columnGap > 0 ? `${layout.columnGap}px` : undefined,
                paddingLeft: layout.paddingX > 0 ? `${layout.paddingX}px` : undefined,
                paddingRight: layout.paddingX > 0 ? `${layout.paddingX}px` : undefined,
                visibility: layout.stride > 0 ? 'visible' : 'hidden'
              }}
            >
              <EpubPreviewBody text={text} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
