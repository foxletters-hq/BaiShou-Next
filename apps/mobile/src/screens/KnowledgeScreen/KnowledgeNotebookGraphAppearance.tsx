import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_APPEARANCE_RANGES,
  GRAPH_FORCE_RANGES,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { NativeSlider, Switch, useNativeTheme } from '@baishou/ui/native'

export function KnowledgeNotebookGraphAppearance(props: {
  appearanceSettings: GraphAppearanceSettings
  forceSettings: GraphForceSettings
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  onForceChange: (patch: Partial<GraphForceSettings>) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const nodeRange = GRAPH_APPEARANCE_RANGES.nodeSize
  const chargeRange = GRAPH_FORCE_RANGES.chargeStrength
  const labelStyle = {
    color: colors.textSecondary,
    fontSize: settingsTypography.desc.fontSize,
    fontWeight: settingsTypography.desc.fontWeight,
    flex: 1
  } as const

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <Text style={labelStyle}>{t('graph.appearance', '外观')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
        <Text style={labelStyle}>{t('graph.show_arrows', '箭头')}</Text>
        <Switch
          value={props.appearanceSettings.showArrows}
          onValueChange={(value) => props.onAppearanceChange({ showArrows: value })}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
        <Text style={labelStyle}>{t('graph.show_isolated_nodes', '独立节点')}</Text>
        <Switch
          value={props.appearanceSettings.showIsolatedNodes}
          onValueChange={(value) => props.onAppearanceChange({ showIsolatedNodes: value })}
        />
      </View>
      <Text style={labelStyle}>{t('graph.node_size', '节点大小')}</Text>
      <NativeSlider
        value={props.appearanceSettings.nodeSize ?? nodeRange.min}
        minValue={nodeRange.min}
        maxValue={nodeRange.max}
        step={nodeRange.step}
        onChange={(value) => props.onAppearanceChange({ nodeSize: value })}
      />
      <Text style={labelStyle}>{t('graph.force_charge', '斥力')}</Text>
      <NativeSlider
        value={props.forceSettings.chargeStrength}
        minValue={chargeRange.min}
        maxValue={chargeRange.max}
        step={chargeRange.step}
        onChange={(value) => props.onForceChange({ chargeStrength: value })}
      />
    </View>
  )
}
