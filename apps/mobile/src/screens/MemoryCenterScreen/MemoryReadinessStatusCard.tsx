import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { MemoryReadinessRow } from '@baishou/shared'
import { ProviderBrandIcon, settingsCardStyles, useNativeTheme } from '@baishou/ui/native'
import {
  memoryProviderTypeOf,
  memoryReadinessRowById,
  memoryReadinessRowLabel,
  memoryReadinessRowValue,
  memoryVectorMetaLine
} from './memory-center-readiness-copy.util'

type ProviderRef = { id: string; type?: string }

function ParamCell(props: { row: MemoryReadinessRow; providers: ReadonlyArray<ProviderRef> }) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const providerType = memoryProviderTypeOf(props.providers, props.row.providerId)
  return (
    <View style={{ flex: 1, minWidth: 0, gap: tokens.spacing.xs }}>
      <Text style={[settingsCardStyles.hint, { color: colors.textTertiary, marginTop: 0 }]}>
        {memoryReadinessRowLabel(props.row.id, t)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
        {props.row.providerId ? (
          <ProviderBrandIcon
            providerId={props.row.providerId}
            providerType={providerType}
            size={12}
          />
        ) : null}
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          style={[settingsCardStyles.hint, { flex: 1, color: colors.textPrimary, marginTop: 0 }]}
        >
          {memoryReadinessRowValue(props.row, t)}
        </Text>
      </View>
    </View>
  )
}

export function MemoryReadinessStatusCard(props: {
  rows?: MemoryReadinessRow[]
  providers?: ReadonlyArray<ProviderRef>
  vectorCount: number
  dimension: number
  organizingLine?: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const embedding = memoryReadinessRowById(props.rows, 'embedding')
  const extract = memoryReadinessRowById(props.rows, 'extract')
  const vector = memoryReadinessRowById(props.rows, 'vector')
  const graph = memoryReadinessRowById(props.rows, 'graph')
  const providers = Array.isArray(props.providers) ? props.providers : []

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('memory.view_current_config', '查看当前配置')}
      onPress={props.onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: tokens.spacing.sm
        }}
      >
        <Text style={[settingsCardStyles.label, { flex: 1, color: colors.textPrimary }]}>
          {t('memory.view_current_config', '查看当前配置')}
        </Text>
        <Text style={[settingsCardStyles.label, { color: colors.textTertiary }]}>›</Text>
      </View>
      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: tokens.spacing.md }}>
          {embedding ? <ParamCell row={embedding} providers={providers} /> : null}
          {extract ? <ParamCell row={extract} providers={providers} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: tokens.spacing.md }}>
          {vector ? <ParamCell row={vector} providers={providers} /> : null}
          {graph ? <ParamCell row={graph} providers={providers} /> : null}
        </View>
      </View>
      <Text
        style={[
          settingsCardStyles.hint,
          { color: colors.textSecondary, marginTop: tokens.spacing.sm }
        ]}
      >
        {memoryVectorMetaLine(props.vectorCount, props.dimension, t)}
      </Text>
      {props.organizingLine ? (
        <Text
          style={[
            settingsCardStyles.hint,
            { color: colors.textTertiary, marginTop: tokens.spacing.xs }
          ]}
        >
          {props.organizingLine}
        </Text>
      ) : null}
    </Pressable>
  )
}
