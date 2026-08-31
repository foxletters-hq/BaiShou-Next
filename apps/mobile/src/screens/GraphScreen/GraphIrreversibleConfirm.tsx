import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'

const CONFIRM_DELAY_MS = 3000

export type GraphMergeConfirmTarget = {
  survivorId: string
  survivorName: string
  losers: Array<{ id: string; name: string }>
}

export function GraphIrreversibleConfirm(props: {
  visible: boolean
  title: string
  warning: string
  survivorName?: string
  losers?: Array<{ id: string; name: string }>
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [remainMs, setRemainMs] = useState(CONFIRM_DELAY_MS)

  useEffect(() => {
    if (!props.visible) {
      setRemainMs(CONFIRM_DELAY_MS)
      return
    }
    setRemainMs(CONFIRM_DELAY_MS)
    const started = Date.now()
    const timer = setInterval(() => {
      const left = Math.max(0, CONFIRM_DELAY_MS - (Date.now() - started))
      setRemainMs(left)
      if (left <= 0) clearInterval(timer)
    }, 200)
    return () => clearInterval(timer)
  }, [props.visible])

  const remainSec = Math.ceil(remainMs / 1000)
  const ready = remainMs <= 0 && !props.busy

  return (
    <FloatingModal
      visible={props.visible}
      onClose={props.onCancel}
      closeOnBackdropPress={!props.busy}
    >
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
          {props.title}
        </Text>
        <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>
          {props.warning}
        </Text>
        {props.survivorName ? (
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
            {t('graph.merge_keep', '保留 · {{name}}', { name: props.survivorName })}
          </Text>
        ) : null}
        {(props.losers ?? []).map((n) => (
          <Text key={n.id} style={{ color: colors.textSecondary, fontSize: 13 }}>
            {t('graph.merge_absorb', '并入 · {{name}}', { name: n.name })}
          </Text>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
          <Pressable disabled={props.busy} onPress={props.onCancel}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
              {t('common.cancel', '取消')}
            </Text>
          </Pressable>
          <Pressable disabled={!ready} onPress={props.onConfirm}>
            <Text style={{ color: ready ? colors.error : colors.textSecondary, fontWeight: '700' }}>
              {ready
                ? t('graph.merge_confirm', '确认合并')
                : t('graph.merge_confirm_wait', '请等待 {{sec}} 秒', { sec: remainSec })}
            </Text>
          </Pressable>
        </View>
      </View>
    </FloatingModal>
  )
}
