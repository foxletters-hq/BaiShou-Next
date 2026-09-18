import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE,
  mcpClientProbeReasonFromError,
  toMcpClientListedTools,
  upsertMcpClientServerStatus,
  type McpClientConfig,
  type McpClientListedTool,
  type McpClientProbeReason,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import { Modal, useToast } from '@baishou/ui'
import { McpClientAddServerForm } from './McpClientAddServerForm'
import { McpClientServerCard } from './McpClientServerCard'
import {
  MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS,
  defaultMcpClientNameFromUrl,
  mcpClientStatusById,
  newMcpClientServerId,
  parseMcpClientUrl,
  withStatusFetchTimeout
} from './mcp-client-servers.util'
import styles from './McpClientServersPanel.module.css'

type TestReason = McpClientProbeReason

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
      if (reason === 'timeout') {
        return t('settings.mcp_custom_tools_timeout', '获取工具超时')
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
      const listed = await withStatusFetchTimeout(
        (async () => {
          try {
            const result = (await window.api.settings.getMcpClientStatuses?.()) as
              | McpClientServerStatus[]
              | undefined
            if (Array.isArray(result)) return result
          } catch (error) {
            console.warn('[McpClientServersPanel] status ipc failed', error)
          }
          return undefined
        })(),
        MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS
      )
      if (listed) {
        setStatuses(listed)
        return
      }

      const probed = await withStatusFetchTimeout(
        Promise.all(
          configRef.current.servers.map(async (server): Promise<McpClientServerStatus> => {
            if (!server.enabled) {
              return { id: server.id, connected: false, tools: [] }
            }
            const result = (await window.api.settings.testMcpClient({
              url: server.url,
              authToken: server.authToken
            })) as {
              ok?: boolean
              tools?: unknown
              error?: string
              reason?: TestReason
            }
            return {
              id: server.id,
              connected: Boolean(result?.ok),
              tools: toMcpClientListedTools(result?.tools),
              error: result?.error,
              reason: result?.reason
            }
          })
        ),
        MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS
      )
      setStatuses(probed)
    } catch (error) {
      console.warn('[McpClientServersPanel] status load failed', error)
      if (mcpClientProbeReasonFromError(error) === 'timeout') {
        setStatuses(
          configRef.current.servers.map((server) => ({
            id: server.id,
            connected: false,
            tools: [],
            reason: server.enabled ? 'timeout' : undefined,
            error: MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
          }))
        )
      }
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
          name: server.name.trim() || defaultMcpClientNameFromUrl(parsed.url),
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
      let result: { ok: boolean; tools?: unknown; error?: string; reason?: TestReason }
      try {
        result = (await withStatusFetchTimeout(
          window.api.settings.testMcpClient({
            url: parsed.url,
            authToken
          }),
          MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS
        )) as { ok: boolean; tools?: unknown; error?: string; reason?: TestReason }
      } catch (error) {
        const reason = mcpClientProbeReasonFromError(error)
        if (serverId) {
          setStatuses((prev) =>
            upsertMcpClientServerStatus(prev, {
              id: serverId,
              connected: false,
              tools: [],
              reason,
              error: error instanceof Error ? error.message : String(error)
            })
          )
        }
        toast.showError(
          urlErrorText(reason, error instanceof Error ? error.message : String(error))
        )
        return false
      }
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
          upsertMcpClientServerStatus(prev, {
            id: serverId,
            connected: false,
            tools: [],
            error: result?.error,
            reason: result?.reason
          })
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
    const name = draftName.trim() || defaultMcpClientNameFromUrl(parsed.url)
    const entry: McpClientServerEntry = {
      id: newMcpClientServerId(),
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

  const lookup = mcpClientStatusById(statuses)

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
            {config.servers.map((server) => (
              <McpClientServerCard
                key={server.id}
                server={server}
                status={lookup.get(server.id)}
                expanded={expandedId === server.id}
                loadingStatuses={loadingStatuses}
                testing={testingId === server.id}
                onToggleExpand={() => setExpandedId(expandedId === server.id ? null : server.id)}
                onViewTools={(tools) => setToolsDialog({ name: server.name, tools })}
                onDraftUrl={(url) => {
                  setConfig((prev) => ({
                    servers: prev.servers.map((item) =>
                      item.id === server.id ? { ...item, url } : item
                    )
                  }))
                }}
                onCommitUrl={(url) => {
                  void patchServer(server.id, { url })
                }}
                onInvalidUrl={(reason) => toast.showError(urlErrorText(reason))}
                onDraftToken={(authToken) => {
                  setConfig((prev) => ({
                    servers: prev.servers.map((item) =>
                      item.id === server.id ? { ...item, authToken } : item
                    )
                  }))
                }}
                onCommitToken={(authToken) => {
                  void patchServer(server.id, { authToken: authToken || undefined })
                }}
                onToggleEnabled={(enabled) => {
                  void patchServer(server.id, { enabled })
                }}
                onRetry={() => {
                  void (async () => {
                    setTestingId(server.id)
                    try {
                      await testUrl(server.url, server.authToken, server.id)
                    } finally {
                      setTestingId(null)
                    }
                  })()
                }}
                onDelete={() => void handleDelete(server.id)}
              />
            ))}
          </ul>
        )}

        <McpClientAddServerForm
          adding={adding}
          draftName={draftName}
          draftUrl={draftUrl}
          draftToken={draftToken}
          testing={testingId === 'draft'}
          onToggleAdding={() => setAdding((prev) => !prev)}
          onDraftName={setDraftName}
          onDraftUrl={setDraftUrl}
          onDraftToken={setDraftToken}
          onTest={() => {
            void (async () => {
              setTestingId('draft')
              try {
                await testUrl(draftUrl, draftToken)
              } finally {
                setTestingId(null)
              }
            })()
          }}
          onAdd={() => void handleAdd()}
        />
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
                {tool.description ? (
                  <span className={styles.toolDesc}>{tool.description}</span>
                ) : null}
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
