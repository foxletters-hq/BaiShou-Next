import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE,
  logger,
  mcpClientProbeReasonFromError,
  toMcpClientListedTools,
  upsertMcpClientServerStatus,
  type McpClientConfig,
  type McpClientListedTool,
  type McpClientProbeReason,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import {
  getMobileMcpClientRuntime
} from '../services/mobile-mcp-client-runtime'
import {
  MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS,
  defaultMcpClientNameFromUrl,
  mcpClientStatusById,
  newMcpClientServerId,
  parseMcpClientUrl,
  withStatusFetchTimeout
} from '../services/mobile-mcp-client-servers.util'

type TestReason = McpClientProbeReason

export function useMobileMcpClientServers() {
  const { t } = useTranslation()
  const toast = useNativeToast()
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
  const configRef = useRef(config)
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
        getMobileMcpClientRuntime().listServerStatuses(),
        MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS
      )
      setStatuses(listed)
    } catch (error) {
      logger.warn('[useMobileMcpClientServers] status load failed', error as Error)
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
        const result = await getMobileMcpClientRuntime().ensureLoaded()
        if (!cancelled) setConfig(result)
      } catch (error) {
        logger.warn('[useMobileMcpClientServers] load failed', error as Error)
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
      const saved = await getMobileMcpClientRuntime().saveConfig({ servers })
      setConfig(saved)
      await refreshStatuses()
      return saved
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
        result = await withStatusFetchTimeout(
          getMobileMcpClientRuntime().testConnection(parsed.url, authToken),
          MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS
        )
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

  const retryServer = useCallback(
    (server: McpClientServerEntry) => {
      void (async () => {
        setTestingId(server.id)
        try {
          await testUrl(server.url, server.authToken, server.id)
        } finally {
          setTestingId(null)
        }
      })()
    },
    [testUrl]
  )

  const testDraft = useCallback(() => {
    void (async () => {
      setTestingId('draft')
      try {
        await testUrl(draftUrl, draftToken)
      } finally {
        setTestingId(null)
      }
    })()
  }, [draftToken, draftUrl, testUrl])

  return {
    config,
    setConfig,
    statuses,
    lookup: mcpClientStatusById(statuses),
    loading,
    loadingStatuses,
    draftName,
    setDraftName,
    draftUrl,
    setDraftUrl,
    draftToken,
    setDraftToken,
    testingId,
    expandedId,
    setExpandedId,
    adding,
    setAdding,
    toolsDialog,
    setToolsDialog,
    urlErrorText,
    notifyUrlError: (reason: TestReason | undefined, fallback?: string) => {
      toast.showError(urlErrorText(reason, fallback))
    },
    persist,
    patchServer,
    handleAdd,
    handleDelete,
    retryServer,
    testDraft
  }
}
