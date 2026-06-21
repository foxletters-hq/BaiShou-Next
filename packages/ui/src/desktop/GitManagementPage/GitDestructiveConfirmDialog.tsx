import React, { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { GitRollbackAllContext } from '@baishou/shared'

export type GitDestructiveConfirmRequest =
  | { type: 'discard-file'; path: string; untracked?: boolean }
  | { type: 'discard-all' }
  | { type: 'rollback'; hash: string; message?: string; context?: GitRollbackAllContext }
  | { type: 'rollback-file'; path: string; hash: string }
  | null

export interface GitDestructiveConfirmDialogProps {
  request: GitDestructiveConfirmRequest
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const GitDestructiveConfirmDialog: React.FC<GitDestructiveConfirmDialogProps> = ({
  request,
  isConfirming = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!request || typeof document === 'undefined') return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [request])

  useEffect(() => {
    if (!request || typeof document === 'undefined') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [request, isConfirming, onCancel])

  if (!request || typeof document === 'undefined') return null

  const { title, message, confirmLabel } = (() => {
    switch (request.type) {
      case 'discard-file':
        return {
          title: t('version_control.discard_confirm_title', '确认撤销变更？'),
          message: request.untracked
            ? t(
                'version_control.discard_confirm_message_untracked',
                '将永久删除未跟踪文件「{{path}}」，此操作不可恢复。',
                { path: request.path }
              )
            : t(
                'version_control.discard_confirm_message_file',
                '将丢弃「{{path}}」的未暂存修改，此操作不可恢复。',
                { path: request.path }
              ),
          confirmLabel: t('version_control.discard', '撤销')
        }
      case 'discard-all':
        return {
          title: t('version_control.discard_confirm_title', '确认撤销变更？'),
          message: t(
            'version_control.discard_confirm_message_all',
            '将丢弃全部未暂存修改（含已跟踪文件的变更），并删除未跟踪的新文件，此操作不可恢复。'
          ),
          confirmLabel: t('version_control.discard_all', '全部撤销')
        }
      case 'rollback': {
        const parts = [
          t(
            'version_control.rollback_confirm_message',
            '将把 HEAD 回滚到提交「{{message}}」（{{hash}}）。该提交之后的所有变更将保留为未提交修改，你可自行查看、暂存或提交。',
            {
              message: request.message || t('version_control.rollback_unknown_message', '未知提交'),
              hash: request.hash.slice(0, 7)
            }
          )
        ]
        if (request.context?.hasUncommittedChanges) {
          parts.push(
            t(
              'version_control.rollback_warn_dirty',
              '当前工作区已有未提交修改，回滚后将与上述变更一并显示在未提交区域。'
            )
          )
        }
        if (request.context?.hasRemote && (request.context.commitsAfterTarget ?? 0) > 0) {
          parts.push(
            t(
              'version_control.rollback_warn_remote',
              '已配置远程仓库：本地将移出 {{count}} 个提交。若这些提交曾推送到远程，之后推送可能需要强制同步，请谨慎操作。',
              { count: request.context.commitsAfterTarget }
            )
          )
        }
        return {
          title: t('version_control.rollback_confirm_title', '确认回滚到此版本？'),
          message: parts.join('\n\n'),
          confirmLabel: t('version_control.rollback', '回滚')
        }
      }
      case 'rollback-file':
        return {
          title: t('version_control.rollback_file_confirm_title', '确认撤销此提交的改动？'),
          message: t(
            'version_control.rollback_file_confirm_message',
            '将撤销提交 {{hash}} 对「{{path}}」的改动，结果保留在工作区（未自动提交）。',
            { path: request.path, hash: request.hash.slice(0, 7) }
          ),
          confirmLabel: t('version_control.rollback', '回滚')
        }
    }
  })()

  return createPortal(
    <div className="gmp-confirm-overlay" onClick={isConfirming ? undefined : onCancel}>
      <div
        className="gmp-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="gmp-confirm-icon">
          <AlertTriangle size={28} color="var(--color-warning, #f59e0b)" />
        </div>
        <div className="gmp-confirm-title" id={titleId}>
          {title}
        </div>
        <div className="gmp-confirm-message" id={messageId} style={{ whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div className="gmp-confirm-actions">
          <button
            type="button"
            className="gmp-btn gmp-btn-secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className="gmp-btn gmp-btn-danger"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
