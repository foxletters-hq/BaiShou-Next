import React, { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../Button/Button'
import {
  AgentGateKind,
  AgentGateReply,
  buildCompanionAskQuestionAnswers,
  listAgentGateFileChangePreviews,
  resolveCompanionAskQuestions,
  type AgentGateFileChangePreview,
  type AgentGateRequest
} from '@baishou/shared'
import {
  formatCoalescedToolHint,
  shouldCollectRejectFeedback,
  shouldShowAlwaysAllow,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import { CompanionAskFields } from './CompanionAskFields'
import { DiffChanges } from '../../agent-workspace/DiffChanges'
import { formatFileChangeListPath } from '../../agent-workspace/file-change.utils'
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
  /** 工作台点文件行时打开中间编辑器 diff；缺省则只展示文件与加减行 */
  onOpenFileChange?: (preview: AgentGateFileChangePreview) => void
}

function FileChangePreviewRow({
  preview,
  onOpen
}: {
  preview: AgentGateFileChangePreview
  onOpen?: (preview: AgentGateFileChangePreview) => void
}) {
  const { t } = useTranslation()
  const pathLabel = preview.previousPath
    ? `${formatFileChangeListPath(preview.previousPath)} → ${formatFileChangeListPath(preview.path)}`
    : formatFileChangeListPath(preview.path)
  const content = (
    <>
      <span className={styles.fileKind}>{formatFileChangeKindLabel(preview.kind)}</span>
      <span className={styles.filePath}>{pathLabel}</span>
      <DiffChanges additions={preview.additions} deletions={preview.deletions} />
      {preview.truncated ? (
        <span className={styles.fileHint}>{t('agent_gate.diff_truncated', '预览已截断')}</span>
      ) : null}
      {onOpen ? <ChevronRight className={styles.fileChevron} size={14} aria-hidden /> : null}
    </>
  )
  if (onOpen) {
    return (
      <button
        type="button"
        className={`${styles.fileRow} ${styles.fileRowButton}`}
        onClick={() => onOpen(preview)}
        title={t('workbench.open_changed_file', '在中间打开 {{path}}', { path: preview.path })}
      >
        {content}
      </button>
    )
  }
  return <div className={styles.fileRow}>{content}</div>
}

export const AgentGateDock: React.FC<AgentGateDockProps> = ({
  request,
  isReplying = false,
  onReply,
  queueIndex = 0,
  queueTotal = 0,
  onQueuePrev,
  onQueueNext,
  placement = 'inline',
  onOpenFileChange
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const askQuestions = request ? resolveCompanionAskQuestions(request) : []
  const askDrafts = useCompanionAskDrafts(askQuestions)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
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
  const queueLabel = formatGateQueueLabel(queueIndex, queueTotal)
  const preview = request.preview
  const filePreviews = listAgentGateFileChangePreviews(request)
  const coalescedHint = formatCoalescedToolHint(request, t)
  const questionText =
    askQuestions.length > 1
      ? t('agent_gate.multi_ask_desc', '请一并确认以下几项。')
      : request.title?.trim() || ''
  const descriptionText = request.description?.trim() || ''
  const numberedOptionsText =
    proactiveOptions && request.options.length > 0
      ? request.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
      : null
  const descriptionIsOptionsDump =
    Boolean(numberedOptionsText) && descriptionText === numberedOptionsText

  const handleReject = () => {
    if (shouldCollectRejectFeedback(request)) {
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
    if (!askDrafts.complete) return
    const questionAnswers = buildCompanionAskQuestionAnswers(askQuestions, askDrafts.drafts)
    const first = questionAnswers[0]
    void onReply({
      requestId: request.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: first?.selectedOptionIds,
      message: first?.message,
      questionAnswers
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
      askQuestions.length <= 1 &&
      descriptionText &&
      !descriptionIsOptionsDump &&
      descriptionText !== questionText ? (
        <p className={styles.hint}>{descriptionText}</p>
      ) : null}
      {coalescedHint ? <p className={styles.hint}>{coalescedHint}</p> : null}

      {filePreviews.length > 0 ? (
        <div className={styles.fileList}>
          {filePreviews.map((filePreview) => (
            <FileChangePreviewRow
              key={`${filePreview.kind}:${filePreview.path}:${filePreview.previousPath ?? ''}`}
              preview={filePreview}
              onOpen={onOpenFileChange}
            />
          ))}
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
        <CompanionAskFields questions={askQuestions} isReplying={isReplying} drafts={askDrafts} />
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
            disabled={isReplying || !askDrafts.complete}
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
