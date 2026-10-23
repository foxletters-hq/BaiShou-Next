import React, { useState } from 'react'
import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { useMobileMcpClientServers } from '../../../hooks/useMobileMcpClientServers'
import { McpClientAddServerForm } from './McpClientAddServerForm'
import { McpClientServerCard } from './McpClientServerCard'
import { McpClientServerDetailModal } from './McpClientServerDetailModal'

export function McpClientServersSection() {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const model = useMobileMcpClientServers()
  const [detailServerId, setDetailServerId] = useState<string | null>(null)

  if (model.loading) {
    return (
      <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const hasServers = model.config.servers.length > 0
  const detailServer = model.config.servers.find((s) => s.id === detailServerId) ?? null

  return (
    <View style={{ gap: tokens.spacing.md }}>
      {!hasServers ? (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: tokens.spacing.xl * 2,
            minHeight: 280
          }}
        >
          <Pressable
            onPress={() => model.setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.mcp_custom_new_title', '新建 MCP 服务')}
            accessibilityHint={t('settings.mcp_custom_empty', '尚未添加外部 MCP')}
            style={({ pressed }) => [
              {
                width: 170,
                height: 170,
                borderRadius: tokens.radius.xl,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: pressed ? colors.primary : colors.borderControl,
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.04)'
                  : colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                padding: tokens.spacing.lg,
                gap: tokens.spacing.sm
              }
            ]}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: tokens.radius.full,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plus size={30} color={colors.primary} strokeWidth={2.5} />
            </View>
            <Text
              style={{
                fontSize: settingsTypography.section.fontSize,
                fontWeight: '600',
                color: colors.textPrimary,
                textAlign: 'center'
              }}
            >
              {t('settings.mcp_custom_new_title', '新建 MCP 服务')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* 添加自定义 MCP 按钮始终放到第一行 */}
          <Pressable
            onPress={() => model.setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.mcp_custom_new_title', '新建 MCP 服务')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.spacing.sm,
                paddingVertical: tokens.spacing.md,
                borderRadius: tokens.radius.lg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: pressed ? colors.primary : colors.borderControl,
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.04)'
                  : colors.bgSurface
              }
            ]}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2.5} />
            <Text
              style={{
                fontSize: settingsTypography.row.fontSize,
                fontWeight: '600',
                color: colors.primary
              }}
            >
              {t('settings.mcp_custom_new_title', '新建 MCP 服务')}
            </Text>
          </Pressable>

          {/* 各个已添加服务的长条形卡片 */}
          {model.config.servers.map((server) => (
            <McpClientServerCard
              key={server.id}
              server={server}
              status={model.lookup.get(server.id)}
              loadingStatuses={model.loadingStatuses}
              testing={model.testingId === server.id}
              onPress={() => setDetailServerId(server.id)}
              onToggleEnabled={(enabled) => {
                void model.patchServer(server.id, { enabled })
              }}
            />
          ))}
        </>
      )}

      {/* 新建 MCP 服务弹窗 */}
      <McpClientAddServerForm
        visible={model.adding}
        adding={model.adding}
        draftName={model.draftName}
        draftUrl={model.draftUrl}
        draftToken={model.draftToken}
        testing={model.testingId === 'draft'}
        onClose={() => model.setAdding(false)}
        onToggleAdding={() => model.setAdding((prev) => !prev)}
        onDraftName={model.setDraftName}
        onDraftUrl={model.setDraftUrl}
        onDraftToken={model.setDraftToken}
        onTest={model.testDraft}
        onAdd={() => void model.handleAdd()}
      />

      {/* 详情弹窗（测试连接、获取所有工具、编辑保存与删除） */}
      <McpClientServerDetailModal
        visible={detailServer !== null}
        server={detailServer}
        status={detailServer ? model.lookup.get(detailServer.id) : undefined}
        testing={detailServer ? model.testingId === detailServer.id : false}
        onClose={() => setDetailServerId(null)}
        onSave={async (patch) => {
          if (detailServer) {
            await model.patchServer(detailServer.id, patch)
          }
        }}
        onTest={(draft) => {
          if (detailServer) {
            const targetUrl = draft?.url?.trim() || detailServer.url
            const targetToken =
              draft?.authToken !== undefined ? draft.authToken : detailServer.authToken
            model.retryServer({ ...detailServer, url: targetUrl, authToken: targetToken })
          }
        }}
        onDelete={async () => {
          if (detailServer) {
            await model.handleDelete(detailServer.id)
          }
        }}
        onInvalidUrl={(reason) => model.notifyUrlError(reason as any)}
      />
    </View>
  )
}
