import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isNotebookHeavyConfirmReady, notebookHeavyConfirmSecondsLeft } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, useNativeTheme } from '@baishou/ui/native'

export function KnowledgeNotebookDeleteDialog(props: {
  visible: boolean
  notebookName: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!props.visible) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [props.visible, props.notebookName])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = notebookHeavyConfirmSecondsLeft(startedAt || now, now)

  return (
    <Modal
      visible={props.visible}
      title={t('knowledge.delete_notebook_title', '删除笔记本')}
      onClose={props.busy ? undefined : props.onCancel}
    >
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize,
          fontWeight: settingsTypography.desc.fontWeight,
          marginBottom: tokens.spacing.md
        }}
      >
        {t(
          'knowledge.delete_notebook_confirm',
          '将删除「{{name}}」及其全部资料、抽出正文、向量和本笔记本图谱。仓里的真源会一并去掉，同步后其他设备也会清掉。此操作不能恢复。',
          { name: props.notebookName }
        )}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
        <Button isDisabled={props.busy} onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          destructive
          isDisabled={!ready || props.busy}
          onPress={props.onConfirm}
        >
          {ready
            ? t('knowledge.delete_notebook', '删除笔记本')
            : t('knowledge.heavy_confirm_button', '确认（{{seconds}}）', { seconds: secondsLeft })}
        </Button>
      </View>
    </Modal>
  )
}
