import React, { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../Button/Button'
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import {
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import {
  canFlipGateQueue,
  formatFileChangeKindLabel,
  formatGateQueueLabel
} from '../../agent-gate/agent-gate-preview-copy'
import styles from './AgentGateDock.module.css'

export interface AgentGateDockProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
  /** 队列位置（1-based）；与 queueTotal 一起显示 */
  queueIndex?: number
  queueTotal?: number
  onQueuePrev?: () => void
  onQueueNext?: () => void
  /** Always / Once / Reject 将影响的同 action 数量（含当前） */
  sameActionCount?: number
  /** inline：嵌入输入区上方；overlay：兼容旧浮层 */
  placement?: 'inline' | 'overlay'
}

function DiffLines({ diff }: { diff: string }) {
  return (
    <div className={styles.diffBody}>
      {diff.split('\n').map((line, index) => {
        let className = styles.diffLine
        if (line.startsWith('+') && !line.startsWith('+++')) {
          className = `${styles.diffLine} ${styles.diffAdd}`
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          className = `${styles.diffLine} ${styles.diffDel}`
        } else if (line.startsWith('@@')) {
          className = `${styles.diffLine} ${styles.diffHunk}`
        }
        return (
          <div key={index} className={className}>
            {line}
          </div>
        )
      })}
    </div>
  )
}

export const AgentGateDock: React.FC<AgentGateDockProps> = ({
  request,
  isReplying = false,
  onReply,
  queueIndex = 0,
  queueTotal = 0,
  onQueuePrev,
  onQueueNext,
  placement = 'inline'
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [diffExpanded, setDiffExpanded] = useState(false)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setSelectedOptionId(null)
    setDiffExpanded(false)
  }, [request?.id])

  useEffect(() => {
    if (!request) return
    titleRef.current?.focus()
    // 只在请求身份变化时聚焦标题
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id])

  if (!request) return null

  const proactiveOptions = shouldShowProactiveOptions(request)
  const showAlways = shouldShowAlwaysAllow(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const queueLabel = formatGateQueueLabel(queueIndex, queueTotal)
  const preview = request.preview
  const questionText = request.title?.trim() || ''
  const descriptionText = request.description?.trim() || ''
  const numberedOptionsText =
    proactiveOptions && request.options.length > 0
      ? request.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
      : null
  const descriptionIsOptionsDump =
    Boolean(numberedOptionsText) && descriptionText === numberedOptionsText

  const handleReject = () => {
    if (allowCustomInput) {
      setShowFeedback(true)
      return
    }
    void onReply({ requestId: request.id, reply: AgentGateReply.Reject })
  }

  const submitRejectWithFeedback = () => {
    void onReply({
      requestId: request.id,
      reply: AgentGateReply.Reject,
      message: feedback.trim() || undefined
    })
    setShowFeedback(false)
    setFeedback('')
  }

  const submitProactiveConfirm = () => {
    if (!selectedOptionId) return
    void onReply({
      requestId: request.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: [selectedOptionId]
    })
  }

  const body = (
    <section
      className={`${styles.dock} ${placement === 'inline' ? styles.dockInline : ''}`}
      role="region"
      aria-labelledby={titleId}
      data-agent-gate-dock="true"
    >
      <div className={styles.liveRegion} role="status" aria-live="assertive" aria-atomic="true">
        {t('agent_gate.live_announcement', '需要确认：{{title}}', { title: request.title })}
      </div>

      <div className={styles.headerRow}>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
          {t('agent_gate.dock_title', '需要确认')}
        </h2>
        {queueLabel ? (
          <div className={styles.queueNav}>
            {onQueuePrev || onQueueNext ? (
              <button
                type="button"
                className={styles.queueNavBtn}
                disabled={!canFlipGateQueue(queueIndex, queueTotal, -1) || isReplying}
                onClick={onQueuePrev}
                aria-label={t('agent_gate.queue_prev', '上一题')}
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <p className={styles.queueLabel}>{queueLabel}</p>
            {onQueuePrev || onQueueNext ? (
              <button
                type="button"
                className={styles.queueNavBtn}
                disabled={!canFlipGateQueue(queueIndex, queueTotal, 1) || isReplying}
                onClick={onQueueNext}
                aria-label={t('agent_gate.queue_next', '下一题')}
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {preview ? (
        questionText ? (
          <p className={styles.description}>{questionText}</p>
        ) : null
      ) : proactiveOptions ? (
        questionText ? (
          <p className={styles.description}>{questionText}</p>
        ) : (
          <p className={styles.description}>
            {t('agent_gate.proactive_desc', '伙伴想向你确认一个问题。')}
          </p>
        )
      ) : descriptionText && !descriptionIsOptionsDump ? (
        <p className={styles.description}>{descriptionText}</p>
      ) : questionText ? (
        <p className={styles.description}>{questionText}</p>
      ) : (
        <p className={styles.description}>
          {request.kind === AgentGateKind.Lifecycle
            ? t('agent_gate.lifecycle_desc', '会话即将进入自动处理流程，需要你确认。')
            : t('agent_gate.dock_desc', '需要你确认后才能继续执行。')}
        </p>
      )}
      {!preview &&
      proactiveOptions &&
      descriptionText &&
      !descriptionIsOptionsDump &&
      descriptionText !== questionText ? (
        <p className={styles.hint}>{descriptionText}</p>
      ) : null}

      {preview?.type === 'file_change' ? (
        <div className={styles.previewBlock}>
          <div className={styles.previewStats}>
            <span>
              {formatFileChangeKindLabel(preview.kind)} · {preview.path}
              {preview.previousPath ? ` ← ${preview.previousPath}` : ''}
            </span>
            {preview.additions > 0 ? (
              <span className={styles.additions}>+{preview.additions}</span>
            ) : null}
            {preview.deletions > 0 ? (
              <span className={styles.deletions}>-{preview.deletions}</span>
            ) : null}
            {preview.truncated ? <span>{t('agent_gate.diff_truncated', '预览已截断')}</span> : null}
          </div>
          {preview.diff ? (
            <>
              <button
                type="button"
                className={styles.diffToggle}
                onClick={() => setDiffExpanded((v) => !v)}
              >
                {diffExpanded
                  ? t('agent_gate.collapse_diff', '收起 Diff')
                  : t('agent_gate.expand_diff', '展开 Diff')}
              </button>
              {diffExpanded ? <DiffLines diff={preview.diff} /> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {preview?.type === 'command' ? (
        <div className={styles.previewBlock}>
          <code className={styles.commandBlock}>{preview.command}</code>
          {preview.workdir ? (
            <p className={styles.meta}>
              {t('agent_gate.workdir', '工作目录：{{dir}}', { dir: preview.workdir })}
            </p>
          ) : null}
          {preview.externalPaths && preview.externalPaths.length > 0 ? (
            <p className={styles.meta}>
              {t('agent_gate.external_paths', '区外路径：{{paths}}', {
                paths: preview.externalPaths.join(', ')
              })}
            </p>
          ) : null}
          {preview.dangerReason ? <p className={styles.hint}>{preview.dangerReason}</p> : null}
        </div>
      ) : null}

      {preview?.type === 'content' ? (
        <div className={styles.previewBlock}>
          {preview.subject && preview.subject !== questionText ? (
            <p className={styles.description}>{preview.subject}</p>
          ) : null}
          {preview.summary &&
          !preview.detailLines?.some(
            (line) => line.includes(preview.summary!) || line.endsWith(preview.summary!)
          ) ? (
            <p className={styles.meta}>{preview.summary}</p>
          ) : null}
          {preview.detailLines?.map((line) => (
            <p key={line} className={styles.meta}>
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {proactiveOptions && !showFeedback ? (
        <div className={styles.options} role="radiogroup" aria-label={request.title}>
          {request.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selectedOptionId === option.id}
              className={`${styles.option} ${selectedOptionId === option.id ? styles.optionSelected : ''}`}
              onClick={() => setSelectedOptionId(option.id)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {showFeedback ? (
        <div className={styles.feedback}>
          <textarea
            className={styles.feedbackInput}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t(
              proactiveOptions
                ? 'agent_gate.custom_answer_placeholder'
                : 'agent_gate.reject_feedback_placeholder',
              proactiveOptions ? '输入你的回答或说明…' : '告诉伙伴为什么拒绝（可选）…'
            )}
            autoFocus
          />
          <div className={styles.feedbackActions}>
            <Button
              type="button"
              disabled={isReplying}
              onClick={() => {
                setShowFeedback(false)
                setFeedback('')
              }}
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              type="button"
              className={proactiveOptions ? undefined : styles.btnReject}
              disabled={isReplying}
              onClick={submitRejectWithFeedback}
            >
              {proactiveOptions
                ? t('agent_gate.submit_answer', '提交回答')
                : t('agent_gate.reject', '拒绝')}
            </Button>
          </div>
        </div>
      ) : proactiveOptions ? (
        <div className={styles.actions}>
          {allowCustomInput ? (
            <Button type="button" disabled={isReplying} onClick={() => setShowFeedback(true)}>
              {t('agent_gate.custom_answer', '自定义回答')}
            </Button>
          ) : null}
          <Button
            type="button"
            className={styles.btnReject}
            disabled={isReplying}
            onClick={handleReject}
          >
            {t('agent_gate.reject', '拒绝')}
          </Button>
          <Button
            type="button"
            disabled={isReplying || !selectedOptionId}
            onClick={submitProactiveConfirm}
          >
            {t('agent_gate.confirm', '确认')}
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button
            type="button"
            className={styles.btnReject}
            disabled={isReplying}
            onClick={handleReject}
            aria-label={t('agent_gate.reject', '拒绝')}
          >
            {t('agent_gate.reject', '拒绝')}
          </Button>
          {showAlways ? (
            <Button
              type="button"
              disabled={isReplying}
              onClick={() => void onReply({ requestId: request.id, reply: AgentGateReply.Always })}
              aria-label={t('agent_gate.always', '始终允许')}
            >
              {t('agent_gate.always', '始终允许')}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={isReplying}
            onClick={() => void onReply({ requestId: request.id, reply: AgentGateReply.Once })}
            aria-label={t('agent_gate.once', '本次允许')}
          >
            {t('agent_gate.once', '本次允许')}
          </Button>
        </div>
      )}
    </section>
  )

  if (placement === 'overlay') {
    return <div className={styles.dockOverlayHost}>{body}</div>
  }
  return body
}
