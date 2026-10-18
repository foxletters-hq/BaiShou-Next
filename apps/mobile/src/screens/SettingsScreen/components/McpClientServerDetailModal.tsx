import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  summarizeMcpToolDescription,
  type McpClientServerEntry,
  type McpClientServerStatus
} from '@baishou/shared'
import {
  Button,
  HelpTooltip,
  Input,
  Modal,
  Switch,
  modalActionsStyle,
  useSettingsCardStyles,
  useNativeTheme
} from '@baishou/ui/native'
import { parseMcpClientUrl } from '../../../services/mobile-mcp-client-servers.util'

export interface McpClientServerDetailModalProps {
  visible: boolean
  server: McpClientServerEntry | null
  status?: McpClientServerStatus
  testing: boolean
  onClose: () => void
  onSave: (patch: Partial<McpClientServerEntry>) => Promise<void>
  onTest: (draft?: { url?: string; authToken?: string }) => void
  onDelete: () => Promise<void>
  onInvalidUrl: (reason: string) => void
}

export function McpClientServerDetailModal({
  visible,
  server,
  status,
  testing,
  onClose,
  onSave,
  onTest,
  onDelete,
  onInvalidUrl
}: McpClientServerDetailModalProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const cardStyles = useSettingsCardStyles()

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [alwaysAllow, setAlwaysAllow] = useState(false)

  useEffect(() => {
    if (server) {
      setName(server.name)
      setUrl(server.url)
      setAuthToken(server.authToken ?? '')
      setEnabled(server.enabled)
      setAlwaysAllow(Boolean(server.alwaysAllow))
    }
  }, [server])

  if (!server) return null

  const tools = status?.tools ?? []
  const connected = Boolean(status?.connected)

  const handleSave = async () => {
    const parsed = parseMcpClientUrl(url)
    if ('error' in parsed) {
      onInvalidUrl(parsed.error)
      return
    }
    await onSave({
      name: name.trim() || server.name,
      url: parsed.url,
      authToken: authToken.trim() || undefined,
      enabled,
      alwaysAllow
    })
    onClose()
  }

  const handleDelete = async () => {
    await onDelete()
    onClose()
  }

  return (
    <Modal visible={visible} onClose={onClose} title={server.name} avoidKeyboard>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: tokens.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Input
          label={t('settings.mcp_custom_name', '名称')}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
        />

        <Input
          label={t('settings.mcp_custom_url', 'mcp 地址')}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          label={t('settings.mcp_custom_token', '访问令牌（可选）')}
          value={authToken}
          onChangeText={setAuthToken}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: tokens.spacing.xs
          }}
        >
          <Text style={[cardStyles.label, { color: colors.textPrimary }]}>
            {t('settings.mcp_custom_enable', '启用')}
          </Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: tokens.spacing.xs
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xsPlus,
              paddingRight: tokens.spacing.md
            }}
          >
            <Text style={[cardStyles.label, { color: colors.textPrimary, flexShrink: 1 }]}>
              {t('settings.mcp_custom_always_allow', '始终允许（写操作免确认）')}
            </Text>
            <HelpTooltip
              content={t(
                'settings.mcp_custom_always_allow_desc',
                '开启后伙伴调用该服务的所有工具（包括写操作）自动执行，无需弹窗确认'
              )}
            />
          </View>
          <Switch value={alwaysAllow} onValueChange={setAlwaysAllow} />
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Text style={[cardStyles.label, { color: colors.textPrimary }]}>
              {t('settings.mcp_custom_tools_title', {
                name: server.name,
                defaultValue: '可用工具'
              })}
              {tools.length > 0 ? ` (${tools.length})` : ''}
            </Text>
            <Button
              size="sm"
              variant="outline"
              disabled={testing}
              isLoading={testing}
              onPress={() => onTest({ url, authToken })}
            >
              {t('settings.mcp_custom_test', '测试连接')}
            </Button>
          </View>

          {tools.length > 0 ? (
            <View style={{ maxHeight: 180 }}>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={{ gap: tokens.spacing.xs }}
              >
                {tools.map((tool) => {
                  const rawId = tool.name.replace(/^baishou_/, '')
                  const isBaishouBuiltin = tool.name.startsWith('baishou_')
                  const displayTitle = isBaishouBuiltin
                    ? t(`agent.tools.${rawId}`, tool.name)
                    : tool.name
                  const fallbackDesc = summarizeMcpToolDescription(tool.description) ?? ''
                  const displayDesc = isBaishouBuiltin
                    ? t(
                        `agent.tools.${rawId}_desc`,
                        t(`agent.tools.${rawId}_tooltip`, fallbackDesc)
                      )
                    : fallbackDesc
                  return (
                    <View
                      key={tool.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: tokens.spacing.xsPlus,
                        paddingHorizontal: tokens.spacing.smPlus,
                        paddingVertical: tokens.spacing.sm,
                        borderRadius: tokens.radius.md,
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderWidth: 1,
                        borderColor: colors.borderControl
                      }}
                    >
                      <Text
                        style={[
                          cardStyles.label,
                          { color: colors.textPrimary, fontWeight: '600', flexShrink: 1 }
                        ]}
                        numberOfLines={1}
                      >
                        {displayTitle}
                      </Text>
                      {displayDesc ? <HelpTooltip content={displayDesc} /> : null}
                    </View>
                  )
                })}
              </ScrollView>
            </View>
          ) : (
            <Text
              style={[
                cardStyles.hint,
                { color: colors.textTertiary, paddingVertical: tokens.spacing.xs }
              ]}
            >
              {connected
                ? t('settings.mcp_custom_tools_empty', '没有可用工具')
                : t('settings.mcp_custom_tools_test_hint', '点击「测试连接」以获取所有工具')}
            </Text>
          )}
        </View>

        <View
          style={[
            modalActionsStyle,
            { justifyContent: 'space-between', marginTop: tokens.spacing.md }
          ]}
        >
          <Button size="sm" variant="outline" destructive onPress={handleDelete}>
            {t('common.delete', '删除')}
          </Button>
          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            <Button size="sm" variant="outline" onPress={onClose}>
              {t('common.cancel', '取消')}
            </Button>
            <Button size="sm" variant="primary" onPress={handleSave}>
              {t('common.save', '保存')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  )
}
