import React, { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import {
  resolveAlwaysAllowPrefixHint,
  resolveAlwaysDisabledReason,
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import {
  formatFileChangeKindLabel,
  formatGateQueueLabel,
  humanizeRepeatHint,
  resolveScopeLabel
} from '../../agent-gate/agent-gate-preview-copy'
import styles from './AgentGateDock.module.css'

export interface AgentGateDockProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
  /** 队列位置（1-based）；与 queueTotal 一起显示 */
  queueIndex?: number
  queueTotal?: number
  /** Always/Reject 级联将影响的同 action 数量（含当前） */
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
  sameActionCount = 0,
  placement = 'inline'
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [diffExpanded, setDiffExpanded] = useState(false)
  const [alwaysConfirm, setAlwaysConfirm] = useState(false)
  const [techOpen, setTechOpen] = useState(false)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setSelectedOptionId(null)
    setDiffExpanded(false)
    setAlwaysConfirm(false)
    setTechOpen(false)
  }, [request?.id])

  useEffect(() => {
    if (!request) return
    titleRef.current?.focus()
  }, [request?.id])

  useEffect(() => {
    if (!request || !alwaysConfirm) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAlwaysConfirm(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [alwaysConfirm, request])

  if (!request) return null

  const proactiveOptions = shouldShowProactiveOptions(request)
  const showAlways = shouldShowAlwaysAllow(request)
  const alwaysDisabledReason = resolveAlwaysDisabledReason(request)
  const alwaysPrefixHint = resolveAlwaysAllowPrefixHint(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const showActionMeta = request.kind === AgentGateKind.Tool
  const queueLabel = formatGateQueueLabel(queueIndex, queueTotal)
  const repeatHint = humanizeRepeatHint(request)
  const scopeLabel = resolveScopeLabel(request)
  const preview = request.preview
  const cascadeHint =
    sameActionCount > 1
      ? t('agent_gate.cascade_hint', '此决定将影响本会话中另外 {{count}} 个相同操作', {
          count: sameActionCount - 1
        })
      : null

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
        {queueLabel ? <p className={styles.queueLabel}>{queueLabel}</p> : null}
      </div>

      {request.description ? (
        <p className={styles.description}>{request.description}</p>
      ) : request.title ? (
        <p className={styles.description}>{request.title}</p>
      ) : (
        <p className={styles.description}>
          {request.kind === AgentGateKind.Proactive
            ? t('agent_gate.proactive_desc', '伙伴想向你确认一个问题。')
            : request.kind === AgentGateKind.Lifecycle
              ? t('agent_gate.lifecycle_desc', '会话即将进入自动处理流程，需要你确认。')
              : t('agent_gate.dock_desc', '需要你确认后才能继续执行。')}
        </p>
      )}

      {repeatHint ? <p className={styles.hint}>{repeatHint}</p> : null}
      {cascadeHint ? <p className={styles.hint}>{cascadeHint}</p> : null}

      {preview?.type === 'file_change' ? (
        <div className={styles.previewBlock}>
          <div className={styles.previewStats}>
            <span>
              {formatFileChangeKindLabel(preview.kind)} · {preview.path}
              {preview.previousPath ? ` ← ${preview.previousPath}` : ''}
            </span>
            <span className={styles.additions}>+{preview.additions}</span>
            <span className={styles.deletions}>-{preview.deletions}</span>
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
          <p className={styles.description}>{preview.subject}</p>
          {preview.summary ? <p className={styles.meta}>{preview.summary}</p> : null}
          {preview.detailLines?.map((line) => (
            <p key={line} className={styles.meta}>
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <details
        className={styles.techDetails}
        open={techOpen}
        onToggle={(e) => setTechOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{t('agent_gate.tech_details', '技术详情')}</summary>
        <div className={styles.techDetailsBody}>
          {showActionMeta ? (
            <p className={styles.meta}>
              {t('agent_gate.dock_action', '操作：{{action}}', { action: request.action })}
            </p>
          ) : null}
          {request.fingerprint ? (
            <p className={styles.meta}>
              {t('agent_gate.fingerprint_meta', '指纹 {{fp}} · 连打 {{count}}', {
                fp: request.fingerprint.slice(0, 10),
                count: request.repeatCount ?? 1
              })}
            </p>
          ) : null}
          <p className={styles.meta}>{scopeLabel}</p>
        </div>
      </details>

      {alwaysConfirm ? (
        <div className={styles.confirmPanel}>
          <p className={styles.description}>
            {t(
              'agent_gate.always_confirm_body',
              '始终允许将持久保存到本机（可在设置中撤销），范围：{{scope}}。匹配：{{pattern}}。',
              {
                scope: scopeLabel,
                pattern: alwaysPrefixHint ?? request.action
              }
            )}
          </p>
          {cascadeHint ? <p className={styles.hint}>{cascadeHint}</p> : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={isReplying}
              onClick={() => setAlwaysConfirm(false)}
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isReplying}
              onClick={() => void onReply({ requestId: request.id, reply: AgentGateReply.Always })}
            >
              {t('agent_gate.always_confirm', '确认始终允许')}
            </button>
          </div>
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
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={isReplying}
              onClick={() => {
                setShowFeedback(false)
                setFeedback('')
              }}
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${proactiveOptions ? styles.btnPrimary : styles.btnReject}`}
              disabled={isReplying}
              onClick={submitRejectWithFeedback}
            >
              {proactiveOptions
                ? t('agent_gate.submit_answer', '提交回答')
                : t('agent_gate.reject', '拒绝')}
            </button>
          </div>
        </div>
      ) : alwaysConfirm ? null : proactiveOptions ? (
        <div className={styles.actions}>
          {allowCustomInput ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={isReplying}
              onClick={() => setShowFeedback(true)}
            >
              {t('agent_gate.custom_answer', '自定义回答')}
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnReject}`}
            disabled={isReplying}
            onClick={handleReject}
          >
            {t('agent_gate.reject', '拒绝')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isReplying || !selectedOptionId}
            onClick={submitProactiveConfirm}
          >
            {t('agent_gate.confirm', '确认')}
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnReject}`}
            disabled={isReplying}
            onClick={handleReject}
            aria-label={t('agent_gate.reject', '拒绝')}
          >
            {t('agent_gate.reject', '拒绝')}
          </button>
          {showAlways ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={isReplying}
              onClick={() => setAlwaysConfirm(true)}
              aria-label={t('agent_gate.always', '始终允许')}
            >
              {t('agent_gate.always', '始终允许')}
            </button>
          ) : alwaysDisabledReason ? (
            <span className={styles.meta}>{alwaysDisabledReason}</span>
          ) : null}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isReplying}
            onClick={() => void onReply({ requestId: request.id, reply: AgentGateReply.Once })}
            aria-label={t('agent_gate.once', '本次允许')}
          >
            {t('agent_gate.once', '本次允许')}
          </button>
        </div>
      )}
    </section>
  )

  if (placement === 'overlay') {
    return <div className={styles.dockOverlayHost}>{body}</div>
  }
  return body
}
