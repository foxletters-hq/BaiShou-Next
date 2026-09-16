import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'

const AUTO_DISMISS_SECONDS = 3

export function PendingEmbedNotice({
  count,
  needModel,
  onAction,
  onDismiss,
  onMuteStartupReminder
}: {
  count: number
  needModel: boolean
  onAction: () => void
  onDismiss: () => void
  onMuteStartupReminder?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS)
  const pausedRef = useRef(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current) return
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft > 0) return
    onDismissRef.current()
  }, [secondsLeft])

  const message = needModel
    ? t(
        'memory.pending_embed_reminder_need_model',
        '有 {{count}} 项内容还没有嵌入，需要先配置嵌入模型才能补齐',
        { count }
      )
    : t(
        'memory.pending_embed_reminder',
        '有 {{count}} 项内容还没有嵌入，搜索和伙伴回忆暂时用不到它们',
        { count }
      )

  return (
    <Pressable
      onPressIn={() => {
        pausedRef.current = true
      }}
      onPressOut={() => {
        pausedRef.current = false
      }}
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMuted
        }
      ]}
    >
      <Text style={[styles.message, { color: colors.textPrimary }]}>{message}</Text>
      <View style={styles.actions}>
        <Button onPress={onAction}>
          {needModel
            ? t('memory.pending_embed_reminder_need_model_action', '去配置模型')
            : t('memory.pending_embed_reminder_action', '去补齐')}
        </Button>
        <Button variant="outlined" onPress={onDismiss}>
          {t('common.close', '关闭')}
        </Button>
        {onMuteStartupReminder ? (
          <Button variant="text" onPress={onMuteStartupReminder}>
            {t('memory.pending_embed_reminder_mute', '不再自动提示')}
          </Button>
        ) : null}
      </View>
      <Text style={{ color: colors.textTertiary, marginTop: 6, fontSize: 12 }}>
        {t('memory.pending_embed_reminder_autoclose', '{{count}} 秒后关闭', {
          count: secondsLeft
        })}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12
  },
  message: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }
})
