import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, Select, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'

export function AssistantCreateSheet({
  visible,
  onClose,
  onCreated
}: {
  visible: boolean
  onClose: () => void
  onCreated: (assistant: {
    id: string
    name: string
    providerId?: string
    modelId?: string
  }) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { services } = useBaishou()
  const [name, setName] = useState('')
  const [modelKey, setModelKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])

  useEffect(() => {
    if (!visible || !services) return
    void (async () => {
      const providers =
        (await services.settingsManager.get<
          Array<{ id: string; name?: string; models?: Array<{ id: string; name?: string }> }>
        >('ai_providers')) ?? []
      const next: Array<{ label: string; value: string }> = []
      for (const provider of providers) {
        for (const model of provider.models ?? []) {
          next.push({
            value: `${provider.id}::${model.id}`,
            label: `${provider.name || provider.id} / ${model.name || model.id}`
          })
        }
      }
      setOptions(next)
      setModelKey((prev) => prev || next[0]?.value || '')
    })()
  }, [visible, services])

  const resetAndClose = () => {
    setName('')
    setSaving(false)
    onClose()
  }

  const handleSave = async () => {
    if (!services || !name.trim()) return
    setSaving(true)
    try {
      const [providerId, modelId] = modelKey.includes('::')
        ? modelKey.split('::')
        : [undefined, undefined]
      const id = `ast-${Date.now()}`
      await services.assistantManager.create({
        id,
        name: name.trim(),
        description: '',
        systemPrompt: '',
        isDefault: false,
        isPinned: false,
        providerId: providerId || null,
        modelId: modelId || null,
        avatarPath: DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
        assistantKind: 'companion'
      })
      onCreated({ id, name: name.trim(), providerId, modelId })
      resetAndClose()
    } catch (error) {
      toast.showError(
        error instanceof Error ? error.message : t('common.errors.save_failed', '保存失败')
      )
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      onClose={resetAndClose}
      title={t('agent.assistant.create', '新建助手')}
    >
      <View style={styles.body}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={t('agent.assistant.name_label', '伙伴名称')}
        />
        {options.length > 0 ? (
          <Select
            options={options}
            value={modelKey}
            onValueChange={setModelKey}
            placeholder={t('agent.assistant.model', '模型')}
          />
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            {t('agent.assistant.no_model', '还没有可用模型，可稍后在完整编辑里绑定。')}
          </Text>
        )}
        <View style={styles.row}>
          <Button variant="outlined" onPress={resetAndClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button isDisabled={!name.trim() || saving} onPress={() => void handleSave()}>
            {t('common.create', '创建')}
          </Button>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }
})
