import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  SettingsGroupCard,
  settingsCardStyles,
  useNativeTheme
} from '@baishou/ui/native'

export function McpClientAddServerForm({
  adding,
  draftName,
  draftUrl,
  draftToken,
  testing,
  onToggleAdding,
  onDraftName,
  onDraftUrl,
  onDraftToken,
  onTest,
  onAdd
}: {
  adding: boolean
  draftName: string
  draftUrl: string
  draftToken: string
  testing: boolean
  onToggleAdding: () => void
  onDraftName: (value: string) => void
  onDraftUrl: (value: string) => void
  onDraftToken: (value: string) => void
  onTest: () => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <SettingsGroupCard>
      <Button variant="outlined" onPress={onToggleAdding}>
        {adding
          ? t('common.cancel', '取消')
          : t('settings.mcp_custom_new_title', '新建 MCP 服务')}
      </Button>
      {adding ? (
        <View style={{ marginTop: tokens.spacing.md, gap: tokens.spacing.md }}>
          <Text style={[settingsCardStyles.cardDesc, { color: colors.textSecondary }]}>
            {t('settings.mcp_custom_new_desc', '添加自定义 MCP 服务')}
          </Text>
          <Input
            label={t('settings.mcp_custom_name', '名称')}
            value={draftName}
            placeholder={t('settings.mcp_custom_name_placeholder', '例如检索服务')}
            onChangeText={onDraftName}
          />
          <Input
            label={t('settings.mcp_custom_url', '/mcp 地址')}
            value={draftUrl}
            placeholder="http://192.168.1.8:31004/mcp"
            onChangeText={onDraftUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('settings.mcp_custom_token', '访问令牌（可选）')}
            value={draftToken}
            onChangeText={onDraftToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            <Button variant="outlined" disabled={testing} isLoading={testing} onPress={onTest}>
              {t('settings.mcp_custom_test', '测试连接')}
            </Button>
            <Button variant="outlined" onPress={onAdd}>
              {t('settings.mcp_custom_add', '添加')}
            </Button>
          </View>
        </View>
      ) : null}
    </SettingsGroupCard>
  )
}
