import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { findFencedCodeBlockContaining } from '../../shared/diary-codemirror/extensions/fencedCodeScan'
import { ImagePreview } from './ImagePreview'
import { EditorContextMenuHost } from '../ContextMenu/EditorContextMenuHost'
import { useCodeMirrorEditor } from './useCodeMirrorEditor'
import type { CodeMirrorEditorHandle, CodeMirrorEditorProps } from './codeMirrorEditor.types'

// Legacy reference for integration tests: processAttachments, attachment/
export type { CodeMirrorEditorHandle } from './codeMirrorEditor.types'

interface HoveredCodeBlockState {
  top: number
  right: number
  code: string
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(props, ref) {
    const { t } = useTranslation()
    const wrapperRef = useRef<HTMLDivElement>(null)
    const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [hoveredCodeBlock, setHoveredCodeBlock] = useState<HoveredCodeBlockState | null>(null)
    const [copiedCode, setCopiedCode] = useState(false)

    const {
      containerRef,
      viewRef,
      previewSrc,
      setPreviewSrc,
      textContextMenu,
      setTextContextMenu,
      handleDragOver,
      handleDrop,
      handlePaste
    } = useCodeMirrorEditor(props, ref)

    useEffect(() => {
      return () => {
        if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
      }
    }, [])

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        if (target.closest('.cm-code-copy-btn')) return

        const codeLine = target.closest('.cm-code-line') as HTMLElement | null
        const wrapper = wrapperRef.current
        const view = viewRef.current
        if (!codeLine || !wrapper || !view) {
          if (hoveredCodeBlock) setHoveredCodeBlock(null)
          return
        }

        let topLineEl: HTMLElement = codeLine
        while (
          topLineEl.previousElementSibling instanceof HTMLElement &&
          topLineEl.previousElementSibling.classList.contains('cm-code-line')
        ) {
          topLineEl = topLineEl.previousElementSibling
        }

        const wrapperRect = wrapper.getBoundingClientRect()
        const topRect = topLineEl.getBoundingClientRect()
        const top = Math.max(4, topRect.top - wrapperRect.top + 6)
        const right = Math.max(8, wrapperRect.right - topRect.right + 10)

        let codeText = ''
        try {
          const pos = view.posAtDOM(topLineEl, 0)
          const block = findFencedCodeBlockContaining(view.state.doc, pos)
          if (block) {
            codeText = block.content
          }
        } catch {
          codeText = ''
        }

        if (!codeText) {
          const lines: string[] = []
          let curr: HTMLElement | null = topLineEl
          while (curr && curr.classList.contains('cm-code-line')) {
            lines.push(curr.textContent ?? '')
            curr = curr.nextElementSibling instanceof HTMLElement ? curr.nextElementSibling : null
          }
          codeText = lines
            .filter((line, idx) => {
              if (idx === 0 && /^\s*(`{3,}|~{3,})/.test(line)) return false
              if (idx === lines.length - 1 && /^\s*(`{3,}|~{3,})\s*$/.test(line)) return false
              return true
            })
            .join('\n')
        }

        setHoveredCodeBlock((prev) => {
          if (
            prev &&
            Math.abs(prev.top - top) < 1 &&
            Math.abs(prev.right - right) < 1 &&
            prev.code === codeText
          ) {
            return prev
          }
          return { top, right, code: codeText }
        })
      },
      [hoveredCodeBlock, viewRef]
    )

    const handleMouseLeave = useCallback(() => {
      setHoveredCodeBlock(null)
    }, [])

    const handleCopyCode = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (!hoveredCodeBlock?.code) return
        void navigator.clipboard?.writeText(hoveredCodeBlock.code)
        setCopiedCode(true)
        if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
        copyResetTimerRef.current = setTimeout(() => {
          setCopiedCode(false)
        }, 1500)
      },
      [hoveredCodeBlock]
    )

    return (
      <div
        ref={wrapperRef}
        className="codemirror-editor-wrapper"
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div ref={containerRef} style={{ height: '100%' }} />
        {hoveredCodeBlock && (
          <button
            type="button"
            className={`cm-code-copy-btn${copiedCode ? ' copied' : ''}`}
            style={{ top: `${hoveredCodeBlock.top}px`, right: `${hoveredCodeBlock.right}px` }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopyCode}
            title={copiedCode ? t('common.copied', '已复制') : t('diary.copy_code', '复制代码')}
            aria-label={
              copiedCode ? t('common.copied', '已复制') : t('diary.copy_code', '复制代码')
            }
          >
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {previewSrc && (
          <ImagePreview
            src={previewSrc}
            isOpen={!!previewSrc}
            onClose={() => setPreviewSrc(null)}
          />
        )}
        <EditorContextMenuHost menu={textContextMenu} onClose={() => setTextContextMenu(null)} />
      </div>
    )
  }
)
