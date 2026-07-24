import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { selectGroupedPending, selectPendingCount, useAgentGateInboxStore } from '@baishou/store'
import styles from './AgentGatePendingDrawer.module.css'

export interface AgentGatePendingDrawerProps {
  open: boolean
  onClose: () => void
}

export const AgentGatePendingDrawer: React.FC<AgentGatePendingDrawerProps> = ({
  open,
  onClose
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pendingCount = useAgentGateInboxStore(selectPendingCount)
  const groups = useAgentGateInboxStore(selectGroupedPending)
  const items = useMemo(() => groups, [groups])

  if (!open) return null

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={t('agent_gate.pending_drawer_title', '待确认操作')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <Shield size={16} aria-hidden />
          <h2 className={styles.title}>
            {t('agent_gate.pending_drawer_title', '待确认操作')}
            {pendingCount > 0 ? ` · ${pendingCount}` : ''}
          </h2>
          <button type="button" className={styles.close} onClick={onClose}>
            {t('common.close', '关闭')}
          </button>
        </header>

        {items.length === 0 ? (
          <p className={styles.empty}>{t('agent_gate.pending_empty', '当前没有待确认操作')}</p>
        ) : (
          <div className={styles.groups}>
            {items.map((group) => (
              <section key={group.groupKey} className={styles.group}>
                <h3 className={styles.groupTitle}>
                  {group.scope?.kind === 'workspace'
                    ? t('agent_gate.group_workspace', '工作区 · {{id}}', {
                        id: group.scope.workspaceId
                      })
                    : t('agent_gate.group_companion', '伙伴 · {{name}}', {
                        name: group.vaultName || '—'
                      })}
                </h3>
                <p className={styles.sessionId}>
                  {t('agent_gate.session_label', '会话 {{id}}', {
                    id:
                      group.sessionId.length > 12
                        ? `${group.sessionId.slice(0, 10)}…`
                        : group.sessionId
                  })}
                </p>
                <ul className={styles.list}>
                  {group.requests.map((request) => (
                    <li key={request.id}>
                      <button
                        type="button"
                        className={styles.item}
                        onClick={() => {
                          useAgentGateInboxStore
                            .getState()
                            .setFocusedRequest(request.sessionId, request.id)
                          const path =
                            request.scope?.kind === 'workspace'
                              ? `/agent-workspace/${request.sessionId}`
                              : `/chat/${request.sessionId}`
                          navigate(path)
                          onClose()
                        }}
                      >
                        <span className={styles.itemTitle}>{request.title}</span>
                        <span className={styles.itemMeta}>{request.action}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

export function AgentGatePendingBadgeButton(props: {
  onClick: () => void
}): React.ReactElement | null {
  const { t } = useTranslation()
  const count = useAgentGateInboxStore(selectPendingCount)
  if (count <= 0) return null
  return (
    <button
      type="button"
      className={styles.badgeBtn}
      onClick={props.onClick}
      title={t('agent_gate.pending_badge_title', '待确认操作')}
      aria-label={t('agent_gate.pending_badge_aria', '待确认操作，{{count}} 项', { count })}
    >
      <Shield size={14} aria-hidden />
      <span className={styles.badgeCount}>{count > 99 ? '99+' : count}</span>
    </button>
  )
}
