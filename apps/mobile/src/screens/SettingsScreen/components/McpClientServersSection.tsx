import React from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Modal, settingsCardStyles, useNativeTheme } from '@baishou/ui/native'
import { useMobileMcpClientServers } from '../../../hooks/useMobileMcpClientServers'
import { McpClientAddServerForm } from './McpClientAddServerForm'
import { McpClientServerCard } from './McpClientServerCard'

export function McpClientServersSection() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const model = useMobileMcpClientServers()

  if (model.loading) {
    return (
      <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
        {t('settings.mcp_custom_connected', '已连接')}
        {` ${model.config.servers.length}`}
      </Text>
      <Text style={[settingsCardStyles.cardDesc, { color: colors.textSecondary }]}>
        {t(
          'settings.mcp_custom_desc',
          '填写外部服务的 Streamable HTTP /mcp 地址，启用后供本机 Agent 调用。不支持 /sse。'
        )}
      </Text>
      {model.config.servers.length === 0 ? (
        <Text style={[settingsCardStyles.hint, { color: colors.textTertiary }]}>
          {t('settings.mcp_custom_empty', '尚未添加外部 MCP')}
        </Text>
      ) : (
        model.config.servers.map((server) => (
          <McpClientServerCard
            key={server.id}
            server={server}
            status={model.lookup.get(server.id)}
            expanded={model.expandedId === server.id}
            loadingStatuses={model.loadingStatuses}
            testing={model.testingId === server.id}
            onToggleExpand={() =>
              model.setExpandedId(model.expandedId === server.id ? null : server.id)
            }
            onViewTools={(tools) => model.setToolsDialog({ name: server.name, tools })}
            onDraftUrl={(url) => {
              model.setConfig((prev) => ({
                servers: prev.servers.map((item) =>
                  item.id === server.id ? { ...item, url } : item
                )
              }))
            }}
            onCommitUrl={(url) => {
              void model.patchServer(server.id, { url })
            }}
            onInvalidUrl={(reason) => model.notifyUrlError(reason)}
            onDraftToken={(authToken) => {
              model.setConfig((prev) => ({
                servers: prev.servers.map((item) =>
                  item.id === server.id ? { ...item, authToken } : item
                )
              }))
            }}
            onCommitToken={(authToken) => {
              void model.patchServer(server.id, { authToken: authToken || undefined })
            }}
            onToggleEnabled={(enabled) => {
              void model.patchServer(server.id, { enabled })
            }}
            onRetry={() => model.retryServer(server)}
            onDelete={() => void model.handleDelete(server.id)}
          />
        ))
      )}
      <McpClientAddServerForm
        adding={model.adding}
        draftName={model.draftName}
        draftUrl={model.draftUrl}
        draftToken={model.draftToken}
        testing={model.testingId === 'draft'}
        onToggleAdding={() => model.setAdding((prev) => !prev)}
        onDraftName={model.setDraftName}
        onDraftUrl={model.setDraftUrl}
        onDraftToken={model.setDraftToken}
        onTest={model.testDraft}
        onAdd={() => void model.handleAdd()}
      />
      <Modal
        visible={model.toolsDialog !== null}
        onClose={() => model.setToolsDialog(null)}
        title={
          model.toolsDialog
            ? t('settings.mcp_custom_tools_title', {
                name: model.toolsDialog.name,
                defaultValue: '{{name}} 的工具'
              })
            : t('settings.mcp_custom_view_tools', '查看工具')
        }
      >
        {model.toolsDialog && model.toolsDialog.tools.length > 0 ? (
          <ScrollView>
            {model.toolsDialog.tools.map((tool) => (
              <View key={tool.name} style={{ marginBottom: tokens.spacing.md }}>
                <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
                  {tool.name}
                </Text>
                {tool.description ? (
                  <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
                    {tool.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[settingsCardStyles.hint, { color: colors.textTertiary }]}>
            {t('settings.mcp_custom_tools_empty', '没有可用工具')}
          </Text>
        )}
      </Modal>
    </View>
  )
}
