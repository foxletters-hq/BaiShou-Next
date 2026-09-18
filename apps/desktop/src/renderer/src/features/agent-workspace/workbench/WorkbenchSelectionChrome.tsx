import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, MessageSquarePlus } from 'lucide-react'
import type { WorkbenchSelectionAffordanceState } from '@baishou/ui'
import { commentPopoverAnchorFromSelectionCoords } from './workbench-comment-popover.util'
import { addSelectionShortcutLabel } from './workbench-main-pane.util'
import styles from './WorkbenchMainPane.module.css'

export type WorkbenchCommentDraft = {
  startLine: number
  endLine: number
  x: number
  y: number
  text: string
}

export interface WorkbenchSelectionChromeProps {
  selectionAffordance: WorkbenchSelectionAffordanceState | null
  commentDraft: WorkbenchCommentDraft | null
  commentPopoverRef: React.Ref<HTMLDivElement>
  onEmitSelection: (range: { startLine: number; endLine: number }) => void
  onOpenComment: (range: { startLine: number; endLine: number; x?: number; y?: number }) => void
  onCommentTextChange: (text: string) => void
  onCloseComment: () => void
  onSubmitComment: () => void
}

export const WorkbenchSelectionChrome: React.FC<WorkbenchSelectionChromeProps> = ({
  selectionAffordance,
  commentDraft,
  commentPopoverRef,
  onEmitSelection,
  onOpenComment,
  onCommentTextChange,
  onCloseComment,
  onSubmitComment
}) => {
  const { t } = useTranslation()

  return (
    <>
      {selectionAffordance ? (
        <div
          className={styles.selectionAffordance}
          data-placement={selectionAffordance.placement}
          data-workbench-selection-affordance
          style={{
            left: selectionAffordance.left,
            top: selectionAffordance.top
          }}
          onMouseDown={(event) => {
            // 保留编辑器选区，让点击动作读取到同一范围。
            event.preventDefault()
          }}
        >
          <button
            type="button"
            className={styles.selectionAffordanceAction}
            tabIndex={-1}
            title={t(
              'workbench.add_selection_to_chat_with_shortcut',
              '将第 {{start}} 至 {{end}} 行加入对话（{{shortcut}}）',
              {
                start: selectionAffordance.startLine,
                end: selectionAffordance.endLine,
                shortcut: addSelectionShortcutLabel()
              }
            )}
            onClick={() => {
              onEmitSelection({
                startLine: selectionAffordance.startLine,
                endLine: selectionAffordance.endLine
              })
            }}
          >
            <MessageSquarePlus size={14} strokeWidth={1.9} aria-hidden />
            <span>{t('workbench.add_to_chat', '加入对话')}</span>
            <kbd className={styles.selectionAffordanceShortcut}>{addSelectionShortcutLabel()}</kbd>
          </button>
          <button
            type="button"
            className={styles.selectionAffordanceAction}
            tabIndex={-1}
            title={t('workbench.comment_selection', '评论此选区')}
            onClick={() => {
              onOpenComment({
                startLine: selectionAffordance.startLine,
                endLine: selectionAffordance.endLine,
                ...commentPopoverAnchorFromSelectionCoords({
                  left: selectionAffordance.endLeft,
                  right: selectionAffordance.endLeft,
                  top: selectionAffordance.endTop,
                  bottom: selectionAffordance.endTop
                })
              })
            }}
          >
            <MessageSquare size={14} strokeWidth={1.9} aria-hidden />
            <span>{t('workbench.comment_selection', '评论此选区')}</span>
          </button>
        </div>
      ) : null}

      {commentDraft ? (
        <div
          ref={commentPopoverRef}
          className={styles.commentPopover}
          style={{ left: commentDraft.x, top: commentDraft.y }}
        >
          <p className={styles.commentPopoverTitle}>
            {commentDraft.startLine === commentDraft.endLine
              ? t('workbench.comment_line', '评论第 {{line}} 行', {
                  line: commentDraft.startLine
                })
              : t('workbench.comment_lines', '评论第 {{start}} 至 {{end}} 行', {
                  start: commentDraft.startLine,
                  end: commentDraft.endLine
                })}
          </p>
          <textarea
            className={styles.commentPopoverInput}
            value={commentDraft.text}
            autoFocus
            placeholder={t('workbench.comment_placeholder', '写下要交给模型看的评论')}
            onChange={(event) => onCommentTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onCloseComment()
                return
              }
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                onSubmitComment()
              }
            }}
          />
          <div className={styles.commentPopoverActions}>
            <button type="button" onClick={onCloseComment}>
              {t('common.cancel', '取消')}
            </button>
            <button type="button" disabled={!commentDraft.text.trim()} onClick={onSubmitComment}>
              {t('workbench.add_to_chat', '加入对话')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
