import React from 'react'
import { useTranslation } from 'react-i18next'
import { CodeMirrorEditor } from '../DiaryEditor/CodeMirrorEditor'
import { useVerticalDragResize } from './useVerticalDragResize'
import styles from './ResizableMarkdownEditor.module.css'

export interface ResizableMarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  placeholder?: string
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
  onBlur?: () => void
}

export const ResizableMarkdownEditor: React.FC<ResizableMarkdownEditorProps> = ({
  content,
  onChange,
  placeholder,
  defaultHeight = 180,
  minHeight = 100,
  maxHeight = 480,
  onBlur
}) => {
  const { t } = useTranslation()
  const { height, onResizeMouseDown } = useVerticalDragResize({
    initialHeight: defaultHeight,
    minHeight,
    maxHeight
  })

  return (
    <div className={styles.shell} style={{ height }}>
      <div
        className={styles.body}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            onBlur?.()
          }
        }}
      >
        <CodeMirrorEditor content={content} onChange={onChange} placeholder={placeholder} />
      </div>
      <div
        className={styles.resizeHandle}
        onMouseDown={onResizeMouseDown}
        title={t('input.drag_resize', '拖拽调整高度')}
        aria-label={t('input.drag_resize', '拖拽调整高度')}
      >
        <div className={styles.resizeGrip} aria-hidden />
      </div>
    </div>
  )
}
