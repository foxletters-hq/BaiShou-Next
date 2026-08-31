import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import {
  normalizeMcpStreamableUrl,
  toMcpClientListedTools,
  upsertMcpClientServerStatus,
  type McpClientConfig,
  type McpClientListedTool,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import { Input, Modal, Switch, useToast } from '@baishou/ui'
import styles from './McpClientServersPanel.module.css'

type TestReason = 'empty' | 'invalid' | 'sse' | 'connect'

function newServerId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname || 'MCP'
  } catch {
    return 'MCP'
  }
}

function parseMcpClientUrl(raw: string): { url: string } | { error: Exclude<TestReason, 'connect'> } {
  const result = normalizeMcpStreamableUrl(raw)
  if (result.ok === true) return { url: result.url }
  return { error: result.reason }
}

function statusById(statuses: McpClientServerStatus[]): Map<string, McpClientServerStatus> {
  return new Map(statuses.map((item) => [item.id, item]))
}

export const McpClientServersPanel: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [config, setConfig] = useState<McpClientConfig>({ servers: [] })
  const [statuses, setStatuses] = useState<McpClientServerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftToken, setDraftToken] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toolsDialog, setToolsDialog] = useState<{
    name: string
    tools: McpClientListedTool[]
  } | null>(null)
  const configRef = React.useRef(config)
  configRef.current = config

  const urlErrorText = useCallback(
    (reason: TestReason | undefined, fallback?: string) => {
      if (reason === 'empty') {
        return t('settings.mcp_custom_url_empty', '请填写地址')
      }
      if (reason === 'sse') {
        return t('settings.mcp_custom_url_sse', '只支持 /mcp 地址，不支持 /sse')
      }
      if (reason === 'invalid') {
        return t('settings.mcp_custom_url_invalid', '请填写 http(s) 的 /mcp 地址')
      }
      if (reason === 'connect') {
        return fallback?.trim()
          ? `${t('settings.mcp_custom_test_fail', '连接失败')}：${fallback}`
          : t('settings.mcp_custom_test_fail', '连接失败')
      }
      return fallback || t('settings.mcp_custom_test_fail', '连接失败')
    },
    [t]
  )

  const refreshStatuses = useCallback(async () => {
    setLoadingStatuses(true)
    try {
      let listed: McpClientServerStatus[] | undefined
      try {
        const result = (await window.api.settings.getMcpClientStatuses?.()) as
          | McpClientServerStatus[]
          | undefined
        if (Array.isArray(result)) listed = result
      } catch (error) {
        console.warn('[McpClientServersPanel] status ipc failed', error)
      }

      const hasEnabled = configRef.current.servers.some((server) => server.enabled)
      const listedReady =
        listed &&
        (!hasEnabled || listed.some((item) => item.connected || item.tools.length > 0))
      if (listed && listedReady) {
        setStatuses(listed)
        return
      }

      const probed: McpClientServerStatus[] = []
      for (const server of configRef.current.servers) {
        if (!server.enabled) {
          probed.push({ id: server.id, connected: false, tools: [] })
          continue
        }
        const result = (await window.api.settings.testMcpClient({
          url: server.url,
          authToken: server.authToken
        })) as { ok?: boolean; tools?: unknown }
        probed.push({
          id: server.id,
          connected: Boolean(result?.ok),
          tools: toMcpClientListedTools(result?.tools)
        })
      }
      setStatuses(probed)
    } catch (error) {
      console.warn('[McpClientServersPanel] status load failed', error)
    } finally {
      setLoadingStatuses(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await window.api.settings.getMcpClientConfig()
        if (!cancelled && result && typeof result === 'object') {
          setConfig(result as McpClientConfig)
        }
      } catch (error) {
        console.warn('[McpClientServersPanel] load failed', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
      if (!cancelled) await refreshStatuses()
    })()
    return () => {
      cancelled = true
    }
  }, [refreshStatuses])

  const persist = useCallback(
    async (next: McpClientConfig) => {
      const servers: McpClientServerEntry[] = []
      for (const server of next.servers) {
        const parsed = parseMcpClientUrl(server.url)
        if ('error' in parsed) {
          toast.showError(urlErrorText(parsed.error))
          return configRef.current
        }
        servers.push({
          ...server,
          url: parsed.url,
          name: server.name.trim() || defaultNameFromUrl(parsed.url),
          authToken: server.authToken?.trim() || undefined
        })
      }
      const saved = (await window.api.settings.setMcpClientConfig({ servers })) as McpClientConfig
      const resolved = saved ?? { servers }
      setConfig(resolved)
      await refreshStatuses()
      return resolved
    },
    [refreshStatuses, toast, urlErrorText]
  )

  const testUrl = useCallback(
    async (url: string, authToken?: string, serverId?: string) => {
      const parsed = parseMcpClientUrl(url)
      if ('error' in parsed) {
        toast.showError(urlErrorText(parsed.error))
        return false
      }
      const result = (await window.api.settings.testMcpClient({
        url: parsed.url,
        authToken
      })) as { ok: boolean; tools?: unknown; error?: string; reason?: TestReason }
      if (result?.ok) {
        const tools = toMcpClientListedTools(result.tools)
        if (serverId) {
          setStatuses((prev) =>
            upsertMcpClientServerStatus(prev, { id: serverId, connected: true, tools })
          )
        }
        toast.showSuccess(
          t('settings.mcp_custom_test_ok', {
            count: tools.length,
            defaultValue: '连接成功，发现 {{count}} 个工具'
          })
        )
        return true
      }
      if (serverId) {
        setStatuses((prev) =>
          upsertMcpClientServerStatus(prev, { id: serverId, connected: false, tools: [] })
        )
      }
      toast.showError(urlErrorText(result?.reason, result?.error))
      return false
    },
    [t, toast, urlErrorText]
  )

  const handleAdd = useCallback(async () => {
    const parsed = parseMcpClientUrl(draftUrl)
    if ('error' in parsed) {
      toast.showError(urlErrorText(parsed.error))
      return
    }
    const name = draftName.trim() || defaultNameFromUrl(parsed.url)
    const entry: McpClientServerEntry = {
      id: newServerId(),
      name,
      url: parsed.url,
      enabled: true,
      authToken: draftToken.trim() || undefined
    }
    await persist({ servers: [...configRef.current.servers, entry] })
    setDraftName('')
    setDraftUrl('')
    setDraftToken('')
    setAdding(false)
    setExpandedId(entry.id)
  }, [draftName, draftToken, draftUrl, persist, toast, urlErrorText])

  const patchServer = useCallback(
    async (id: string, patch: Partial<McpClientServerEntry>) => {
      const servers = configRef.current.servers.map((server) =>
        server.id === id ? { ...server, ...patch } : server
      )
      await persist({ servers })
    },
    [persist]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await persist({ servers: configRef.current.servers.filter((server) => server.id !== id) })
      setExpandedId((current) => (current === id ? null : current))
    },
    [persist]
  )

  const lookup = statusById(statuses)

  if (loading) {
    return <p className={styles.state}>{t('common.loading', '加载中...')}</p>
  }

  return (
    <div className={styles.root}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{t('settings.mcp_custom_connected', '已连接')}</h3>
        <span className={styles.sectionCount}>{config.servers.length}</span>
      </div>

      <section className={styles.sheet}>
        {config.servers.length === 0 ? (
        <p className={styles.empty}>{t('settings.mcp_custom_empty', '尚未添加外部 MCP')}</p>
      ) : (
        <ul className={styles.list}>
          {config.servers.map((server) => {
            const status = lookup.get(server.id)
            const tools = status?.tools ?? []
            const connected = Boolean(status?.connected)
            const expanded = expandedId === server.id
            const subtitle = !server.enabled
              ? t('settings.mcp_custom_disabled', '未启用')
              : connected
                ? t('settings.mcp_custom_tools_enabled', {
                    count: tools.length,
                    defaultValue: '{{count}} 个工具已启用'
                  })
                : loadingStatuses
                  ? t('settings.mcp_custom_tools_loading', '正在获取工具')
                  : t('settings.mcp_custom_disconnected', '未连接')
            return (
              <li key={server.id} className={styles.row}>
                <div className={styles.cardMain}>
                  <button
                    type="button"
                    className={styles.cardHit}
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : server.id)}
                  >
                    <span className={styles.iconWrap} aria-hidden>
                      <span className={styles.iconMark}>M</span>
                      <span
                        className={`${styles.statusDot} ${
                          connected ? styles.statusOn : styles.statusOff
                        }`}
                      />
                    </span>
                    <span className={styles.cardCopy}>
                      <span className={styles.cardTitleRow}>
                        <span className={styles.cardTitle}>{server.name}</span>
                        <span className={styles.badge}>
                          {t('settings.mcp_custom_badge_user', '用户')}
                        </span>
                      </span>
                      <span className={styles.cardDesc}>{subtitle}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolsBtn}
                    disabled={!connected || tools.length === 0}
                    onClick={() => setToolsDialog({ name: server.name, tools })}
                  >
                    {t('settings.mcp_custom_view_tools', '查看工具')}
                  </button>
                </div>

                {expanded ? (
                  <div className={styles.cardDetail}>
                    <label className={styles.field}>
                      <span>{t('settings.mcp_custom_url', '/mcp 地址')}</span>
                      <Input
                        fieldSize="small"
                        value={server.url}
                        onChange={(event) => {
                          const url = event.target.value
                          setConfig((prev) => ({
                            servers: prev.servers.map((item) =>
                              item.id === server.id ? { ...item, url } : item
                            )
                          }))
                        }}
                        onBlur={(event) => {
                          const parsed = parseMcpClientUrl(event.target.value)
                          if ('error' in parsed) {
                            toast.showError(urlErrorText(parsed.error))
                            return
                          }
                          void patchServer(server.id, { url: parsed.url })
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>{t('settings.mcp_custom_token', '访问令牌（可选）')}</span>
                      <Input
                        fieldSize="small"
                        type="password"
                        autoComplete="off"
                        value={server.authToken ?? ''}
                        onChange={(event) => {
                          const authToken = event.target.value
                          setConfig((prev) => ({
                            servers: prev.servers.map((item) =>
                              item.id === server.id ? { ...item, authToken } : item
                            )
                          }))
                        }}
                        onBlur={(event) => {
                          void patchServer(server.id, {
                            authToken: event.target.value.trim() || undefined
                          })
                        }}
                      />
                    </label>
                    <div className={styles.cardActions}>
                      <label className={styles.enableRow}>
                        <span>{t('settings.mcp_custom_enable', '启用')}</span>
                        <Switch
                          size="sm"
                          checked={server.enabled}
                          onChange={(event) => {
                            void patchServer(server.id, { enabled: event.target.checked })
                          }}
                          aria-label={t('settings.mcp_custom_enable', '启用')}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.textBtn}
                        disabled={testingId === server.id}
                        onClick={async () => {
                          setTestingId(server.id)
                          try {
                            await testUrl(server.url, server.authToken, server.id)
                          } finally {
                            setTestingId(null)
                          }
                        }}
                      >
                        {t('settings.mcp_custom_retry', '重新连接')}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => void handleDelete(server.id)}
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
          })}
        </ul>
      )}

      <div className={styles.row}>
        <div className={styles.cardMain}>
          <button
            type="button"
            className={styles.cardHit}
            aria-expanded={adding}
            onClick={() => setAdding((prev) => !prev)}
          >
            <span className={styles.iconWrap} aria-hidden>
              <Plus size={18} strokeWidth={2} />
            </span>
            <span className={styles.cardCopy}>
              <span className={styles.cardTitle}>
                {t('settings.mcp_custom_new_title', '新建 MCP 服务')}
              </span>
              <span className={styles.cardDesc}>
                {t('settings.mcp_custom_new_desc', '添加自定义 MCP 服务')}
              </span>
            </span>
          </button>
        </div>

        {adding ? (
          <div className={styles.cardDetail}>
            <label className={styles.field}>
              <span>{t('settings.mcp_custom_name', '名称')}</span>
              <Input
                fieldSize="small"
                value={draftName}
                placeholder={t('settings.mcp_custom_name_placeholder', '例如检索服务')}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>{t('settings.mcp_custom_url', '/mcp 地址')}</span>
              <Input
                fieldSize="small"
                value={draftUrl}
                placeholder="http://127.0.0.1:31004/mcp"
                onChange={(event) => setDraftUrl(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>{t('settings.mcp_custom_token', '访问令牌（可选）')}</span>
              <Input
                fieldSize="small"
                type="password"
                autoComplete="off"
                value={draftToken}
                onChange={(event) => setDraftToken(event.target.value)}
              />
            </label>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.textBtn}
                disabled={testingId === 'draft'}
                onClick={async () => {
                  setTestingId('draft')
                  try {
                    await testUrl(draftUrl, draftToken)
                  } finally {
                    setTestingId(null)
                  }
                }}
              >
                {t('settings.mcp_custom_test', '测试连接')}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => void handleAdd()}>
                {t('settings.mcp_custom_add', '添加')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      </section>

      <Modal
        isOpen={toolsDialog !== null}
        onClose={() => setToolsDialog(null)}
        title={
          toolsDialog
            ? t('settings.mcp_custom_tools_title', {
                name: toolsDialog.name,
                defaultValue: '{{name}} 的工具'
              })
            : t('settings.mcp_custom_view_tools', '查看工具')
        }
        closeOnOverlayClick
        className={styles.toolsModal}
      >
        {toolsDialog && toolsDialog.tools.length > 0 ? (
          <ul className={styles.toolList}>
            {toolsDialog.tools.map((tool) => (
              <li key={tool.name} className={styles.toolItem}>
                <span className={styles.toolName}>{tool.name}</span>
                {tool.description ? <span className={styles.toolDesc}>{tool.description}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailState}>
            {t('settings.mcp_custom_tools_empty', '没有可用工具')}
          </p>
        )}
      </Modal>
    </div>
  )
}
