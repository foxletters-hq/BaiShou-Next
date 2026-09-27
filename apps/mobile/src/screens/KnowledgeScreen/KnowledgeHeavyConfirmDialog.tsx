import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isNotebookHeavyConfirmReady, notebookHeavyConfirmSecondsLeft } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, useNativeTheme } from '@baishou/ui/native'

export type KnowledgeHeavyConfirmPrompt = {
  title: string
  body: string
  confirmText: string
}

export function useKnowledgeHeavyConfirm() {
  const [prompt, setPrompt] = useState<KnowledgeHeavyConfirmPrompt | null>(null)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const askHeavyConfirm = useCallback((next: KnowledgeHeavyConfirmPrompt) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setPrompt(next)
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setPrompt(null)
    resolve?.(ok)
  }, [])

  return { prompt, askHeavyConfirm, settle }
}

export function KnowledgeHeavyConfirmDialog(props: {
  prompt: KnowledgeHeavyConfirmPrompt | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const visible = Boolean(props.prompt)

  useEffect(() => {
    if (!visible) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [visible, props.prompt?.title, props.prompt?.body])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = startedAt > 0 ? notebookHeavyConfirmSecondsLeft(startedAt, now) : 3

  return (
    <Modal
      visible={visible}
      title={props.prompt?.title || t('knowledge.heavy_confirm_title', '确认操作')}
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
        {props.prompt?.body}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
        <Button isDisabled={props.busy} onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button isDisabled={!ready || props.busy} onPress={props.onConfirm}>
          {ready
            ? props.prompt?.confirmText || t('common.confirm', '确认')
            : t('knowledge.heavy_confirm_button', '确认（{{seconds}}）', { seconds: secondsLeft })}
        </Button>
      </View>
    </Modal>
  )
}
