import React from 'react'
import { View, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'

export interface McpClientAddServerFormProps {
  adding?: boolean
  visible?: boolean
  draftName: string
  draftUrl: string
  draftToken: string
  testing: boolean
  onToggleAdding?: () => void
  onClose?: () => void
  onDraftName: (value: string) => void
  onDraftUrl: (value: string) => void
  onDraftToken: (value: string) => void
  onTest: () => void
  onAdd: () => void
}

export function McpClientAddServerForm({
  adding = false,
  visible,
  draftName,
  draftUrl,
  draftToken,
  testing,
  onToggleAdding,
  onClose,
  onDraftName,
  onDraftUrl,
  onDraftToken,
  onTest,
  onAdd
}: McpClientAddServerFormProps) {
  const { t } = useTranslation()
  const { tokens } = useNativeTheme()
  const isVisible = visible ?? adding
  const handleClose = onClose ?? onToggleAdding ?? (() => {})

  return (
    <Modal
      visible={isVisible}
      onClose={handleClose}
      title={t('settings.mcp_custom_new_title', '添加自定义 MCP 服务')}
      avoidKeyboard
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: tokens.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Input
          label={t('settings.mcp_custom_name', '名称')}
          value={draftName}
          placeholder={t('settings.mcp_custom_name_placeholder', '例如检索服务')}
          onChangeText={onDraftName}
          autoCapitalize="none"
        />
        <Input
          label={t('settings.mcp_custom_url', 'mcp 地址')}
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
        <View style={modalActionsStyle}>
          <Button
            size="sm"
            variant="outline"
            disabled={testing}
            isLoading={testing}
            onPress={onTest}
          >
            {t('settings.mcp_custom_test', '测试连接')}
          </Button>
          <Button size="sm" variant="outline" onPress={handleClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button size="sm" variant="primary" onPress={onAdd}>
            {t('settings.mcp_custom_add', '添加')}
          </Button>
        </View>
      </ScrollView>
    </Modal>
  )
}
