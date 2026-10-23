import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { MemoryReadinessRow } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Modal,
  modalActionsStyle,
  ProviderBrandIcon,
  useNativeTheme
} from '@baishou/ui/native'
import {
  memoryProviderTypeOf,
  memoryReadinessRowById,
  memoryReadinessRowLabel,
  memoryReadinessRowValue
} from './memory-center-readiness-copy.util'

type ProviderRef = { id: string; type?: string }

function ModelSquareCard(props: {
  row?: MemoryReadinessRow
  providers: ReadonlyArray<ProviderRef>
  extra?: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const row = props.row
  const providerType = memoryProviderTypeOf(props.providers, row?.providerId)
  const label = row ? memoryReadinessRowLabel(row.id, t) : ''
  const value = row
    ? memoryReadinessRowValue(row, t)
    : t('memory.readiness_not_configured', '未配置')
  const valueLine = props.extra ? `${value} · ${props.extra}` : value

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 1,
        minWidth: 0,
        opacity: pressed ? 0.7 : 1,
        borderWidth: 1,
        borderColor: colors.borderControl,
        borderRadius: tokens.radius.md,
        padding: tokens.spacing.sm,
        justifyContent: 'space-between'
      })}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: mobileTypography.secondary.fontSize,
          fontWeight: mobileTypography.secondary.fontWeight
        }}
      >
        {label}
      </Text>
      <View style={{ gap: tokens.spacing.xs }}>
        {row?.providerId ? (
          <ProviderBrandIcon providerId={row.providerId} providerType={providerType} size={20} />
        ) : null}
        <Text
          numberOfLines={3}
          ellipsizeMode="middle"
          style={{
            color: row?.state === 'ready' ? colors.textPrimary : colors.textTertiary,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
        >
          {valueLine}
        </Text>
      </View>
    </Pressable>
  )
}

export function MemoryReadinessSettingsBody(props: {
  rows?: MemoryReadinessRow[]
  providers?: ReadonlyArray<ProviderRef>
  extractEffortLabel?: string
  onPressEmbedding: () => void
  onPressExtract: () => void
}) {
  const { tokens } = useNativeTheme()
  const providers = Array.isArray(props.providers) ? props.providers : []
  const embedding = memoryReadinessRowById(props.rows, 'embedding')
  const extract = memoryReadinessRowById(props.rows, 'extract')

  return (
    <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
      <ModelSquareCard row={embedding} providers={providers} onPress={props.onPressEmbedding} />
      <ModelSquareCard
        row={extract}
        providers={providers}
        extra={extract?.state === 'ready' ? props.extractEffortLabel : undefined}
        onPress={props.onPressExtract}
      />
    </View>
  )
}

export function MemoryReadinessConfigModal(props: {
  visible: boolean
  rows?: MemoryReadinessRow[]
  providers?: ReadonlyArray<ProviderRef>
  extractEffortLabel?: string
  onClose: () => void
  onPressEmbedding: () => void
  onPressExtract: () => void
}) {
  const { t } = useTranslation()
  const { tokens } = useNativeTheme()

  return (
    <Modal visible={props.visible} title={t('common.settings', '设置')} onClose={props.onClose}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
      >
        <MemoryReadinessSettingsBody
          rows={props.rows}
          providers={props.providers}
          extractEffortLabel={props.extractEffortLabel}
          onPressEmbedding={props.onPressEmbedding}
          onPressExtract={props.onPressExtract}
        />
        <View style={modalActionsStyle}>
          <Button variant="outlined" size="sm" onPress={props.onClose}>
            {t('common.close', '关闭')}
          </Button>
        </View>
      </ScrollView>
    </Modal>
  )
}
