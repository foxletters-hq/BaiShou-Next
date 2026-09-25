import React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import {
  isMcpClientTimeoutMessage,
  resolveMcpClientCardStatusKind,
  type McpClientListedTool,
  type McpClientProbeReason,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import { Button, Input, Switch } from '@baishou/ui'
import { parseMcpClientUrl } from './mcp-client-servers.util'
import styles from './McpClientServersPanel.module.css'

export function McpClientServerCard({
  server,
  status,
  expanded,
  loadingStatuses,
  testing,
  onToggleExpand,
  onViewTools,
  onDraftUrl,
  onCommitUrl,
  onInvalidUrl,
  onDraftToken,
  onCommitToken,
  onToggleEnabled,
  onRetry,
  onDelete
}: {
  server: McpClientServerEntry
  status?: McpClientServerStatus
  expanded: boolean
  loadingStatuses: boolean
  testing: boolean
  onToggleExpand: () => void
  onViewTools: (tools: McpClientListedTool[]) => void
  onDraftUrl: (url: string) => void
  onCommitUrl: (url: string) => void
  onInvalidUrl: (reason: McpClientProbeReason) => void
  onDraftToken: (authToken: string) => void
  onCommitToken: (authToken: string) => void
  onToggleEnabled: (enabled: boolean) => void
  onRetry: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const tools = status?.tools ?? []
  const connected = Boolean(status?.connected)
  const timedOut = status?.reason === 'timeout' || isMcpClientTimeoutMessage(status?.error)
  const cardStatus = resolveMcpClientCardStatusKind({
    enabled: server.enabled,
    connected,
    loading: loadingStatuses && !connected,
    timedOut
  })
  const subtitle =
    cardStatus === 'disabled'
      ? t('settings.mcp_custom_disabled', '未启用')
      : cardStatus === 'connected'
        ? t('settings.mcp_custom_tools_enabled', {
            count: tools.length,
            defaultValue: '{{count}} 个工具已启用'
          })
        : cardStatus === 'loading'
          ? t('settings.mcp_custom_tools_loading', '正在获取工具')
          : cardStatus === 'timeout'
            ? t('settings.mcp_custom_tools_timeout', '获取工具超时')
            : t('settings.mcp_custom_disconnected', '未连接')
  const statusDotClass =
    cardStatus === 'connected'
      ? styles.statusOn
      : cardStatus === 'loading'
        ? styles.statusLoading
        : cardStatus === 'timeout'
          ? styles.statusTimeout
          : styles.statusOff

  return (
    <li className={styles.row}>
      <div className={styles.cardMain}>
        <button
          type="button"
          className={styles.cardHit}
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          <span className={styles.iconWrap} aria-hidden>
            <span className={styles.iconMark}>M</span>
            <span className={`${styles.statusDot} ${statusDotClass}`} />
          </span>
          <span className={styles.cardCopy}>
            <span className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>{server.name}</span>
              <span className={styles.badge}>{t('settings.mcp_custom_badge_user', '用户')}</span>
            </span>
            <span className={styles.cardDesc}>{subtitle}</span>
          </span>
        </button>
        <Button
          type="button"
          variant="outlined"
          size="small"
          disabled={!connected || tools.length === 0}
          onClick={() => onViewTools(tools)}
        >
          {t('settings.mcp_custom_view_tools', '查看工具')}
        </Button>
      </div>

      {expanded ? (
        <div className={styles.cardDetail}>
          <label className={styles.field}>
            <span>{t('settings.mcp_custom_url', '/mcp 地址')}</span>
            <Input
              value={server.url}
              onChange={(event) => onDraftUrl(event.target.value)}
              onBlur={(event) => {
                const parsed = parseMcpClientUrl(event.target.value)
                if ('error' in parsed) {
                  onInvalidUrl(parsed.error)
                  return
                }
                onCommitUrl(parsed.url)
              }}
            />
          </label>
          <label className={styles.field}>
            <span>{t('settings.mcp_custom_token', '访问令牌（可选）')}</span>
            <Input
              type="password"
              autoComplete="off"
              value={server.authToken ?? ''}
              onChange={(event) => onDraftToken(event.target.value)}
              onBlur={(event) => onCommitToken(event.target.value.trim())}
            />
          </label>
          <div className={styles.cardActions}>
            <label className={styles.enableRow}>
              <span>{t('settings.mcp_custom_enable', '启用')}</span>
              <Switch
                size="sm"
                checked={server.enabled}
                onChange={(event) => onToggleEnabled(event.target.checked)}
                aria-label={t('settings.mcp_custom_enable', '启用')}
              />
            </label>
            <Button
              type="button"
              variant="outlined"
              size="small"
              disabled={testing}
              isLoading={testing}
              onClick={onRetry}
            >
              {t('settings.mcp_custom_retry', '重新连接')}
            </Button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onDelete}
              aria-label={t('common.delete', '删除')}
              title={t('common.delete', '删除')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
