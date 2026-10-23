import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, FloatingModal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

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
      <View style={{ padding: sharedTokens.spacing.mdPlus, gap: sharedTokens.spacing.mdTight }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: mobileTypography.title.fontSize,
            fontWeight: mobileTypography.title.fontWeight
          }}
        >
          {props.title}
        </Text>
        {(() => {
          const warningText = props.warning
            ? props.warning.replace(/\{\{\s*survivor\s*\}\}/g, props.survivorName || '').replace(
                /\{\{\s*losers\s*\}\}/g,
                (props.losers || [])
                  .map((n) => n.name)
                  .filter(Boolean)
                  .join('、')
              )
            : ''
          return (
            <Text
              style={{
                color: colors.error,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: '600',
                lineHeight: 20
              }}
            >
              {warningText}
            </Text>
          )
        })()}
        {props.survivorName ? (
          <Text
            style={{ color: colors.textPrimary, fontSize: mobileTypography.secondary.fontSize }}
          >
            {t('graph.merge_keep', '保留 · {{name}}', { name: props.survivorName })}
          </Text>
        ) : null}
        {(props.losers ?? []).map((n) => (
          <Text
            key={n.id}
            style={{ color: colors.textSecondary, fontSize: mobileTypography.secondary.fontSize }}
          >
            {t('graph.merge_absorb', '并入 · {{name}}', { name: n.name })}
          </Text>
        ))}
        <View style={modalActionsStyle}>
          <Button size="sm" variant="outlined" isDisabled={props.busy} onPress={props.onCancel}>
            {t('common.cancel', '取消')}
          </Button>
          <Button size="sm" destructive isDisabled={!ready} onPress={props.onConfirm}>
            {ready
              ? t('graph.merge_confirm', '确认合并')
              : t('graph.merge_confirm_wait', '请等待 {{sec}} 秒', { sec: remainSec })}
          </Button>
        </View>
      </View>
    </FloatingModal>
  )
}
