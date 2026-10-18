import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_APPEARANCE_RANGES,
  GRAPH_FORCE_RANGES,
  GRAPH_VIEW_MAX_NODES_MAX,
  GRAPH_VIEW_MAX_NODES_MIN,
  GRAPH_VIEW_MAX_NODES_STEP,
  graphViewMaxNodesSliderValue,
  isGraphViewMaxNodesUnlimited,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, SettingsSliderRow, Switch, useNativeTheme } from '@baishou/ui/native'

export function KnowledgeNotebookGraphAppearance(props: {
  appearanceSettings: GraphAppearanceSettings
  forceSettings: GraphForceSettings
  viewMaxNodes: number
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  onForceChange: (patch: Partial<GraphForceSettings>) => void
  onViewMaxNodesChange: (value: number) => void
  onReplayLayout?: () => void
  onResetGraphSettings?: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const sectionTitle = {
    color: colors.textPrimary,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600' as const
  }
  const switchLabel = {
    color: colors.textSecondary,
    fontSize: mobileTypography.secondary.fontSize,
    flex: 1
  }

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <Text style={sectionTitle}>{t('graph.appearance', '外观')}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm
        }}
      >
        <Text style={switchLabel}>{t('graph.show_arrows', '箭头')}</Text>
        <Switch
          value={props.appearanceSettings.showArrows}
          onValueChange={(value) => props.onAppearanceChange({ showArrows: value })}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm
        }}
      >
        <Text style={switchLabel}>{t('graph.show_isolated_nodes', '独立节点')}</Text>
        <Switch
          value={props.appearanceSettings.showIsolatedNodes}
          onValueChange={(value) => props.onAppearanceChange({ showIsolatedNodes: value })}
        />
      </View>
      <SettingsSliderRow
        title={t('graph.max_nodes', '显示节点上限')}
        description={t(
          'graph.max_nodes_hint',
          '画布最多取这么多个节点。滑到最右为不限制。这个月份里尚未确认的节点仍会补进来，以免漏看。'
        )}
        value={graphViewMaxNodesSliderValue(props.viewMaxNodes)}
        min={GRAPH_VIEW_MAX_NODES_MIN}
        max={GRAPH_VIEW_MAX_NODES_MAX}
        step={GRAPH_VIEW_MAX_NODES_STEP}
        commitOnChangeEnd={false}
        onChange={props.onViewMaxNodesChange}
        formatValue={(value) =>
          isGraphViewMaxNodesUnlimited(value)
            ? t('graph.max_nodes_unlimited', '无限')
            : String(value)
        }
      />
      {(
        [
          ['textOpacity', 'graph.text_opacity', '文本透明度'],
          ['nodeSize', 'graph.node_size', '节点大小'],
          ['lineThickness', 'graph.line_thickness', '连线粗细'],
          ['hubLabelMinDegree', 'graph.hub_label_degree', '显名边数'],
          ['hubLabelMinMentions', 'graph.hub_label_mentions', '显名提及']
        ] as const
      ).map(([key, i18nKey, fallback]) => {
        const range = GRAPH_APPEARANCE_RANGES[key]
        const value = props.appearanceSettings[key]
        return (
          <SettingsSliderRow
            key={key}
            title={t(i18nKey, fallback)}
            description={
              key === 'hubLabelMinDegree'
                ? t(
                    'graph.hub_label_degree_hint',
                    '连接边达到该数量时，全局视图默认显示名称。没有连线的独立节点始终显示名称。'
                  )
                : key === 'hubLabelMinMentions'
                  ? t('graph.hub_label_mentions_hint', '提及次数达到该值时，全局视图默认显示名称')
                  : undefined
            }
            value={value}
            min={range.min}
            max={range.max}
            step={range.step}
            commitOnChangeEnd={false}
            onChange={(next) => props.onAppearanceChange({ [key]: next })}
            formatValue={(next) => (Number.isInteger(range.step) ? String(next) : next.toFixed(2))}
          />
        )
      })}
      <Text style={sectionTitle}>{t('graph.forces', '力度')}</Text>
      {(
        [
          ['centerStrength', 'graph.force_center', '图谱向心力'],
          ['chargeStrength', 'graph.force_charge', '节点排斥力'],
          ['linkStrength', 'graph.force_link', '相连吸引力'],
          ['linkDistance', 'graph.force_link_distance', '连线长度']
        ] as const
      ).map(([key, i18nKey, fallback]) => {
        const range = GRAPH_FORCE_RANGES[key]
        const value = props.forceSettings[key]
        return (
          <SettingsSliderRow
            key={key}
            title={t(i18nKey, fallback)}
            value={value}
            min={range.min}
            max={range.max}
            step={range.step}
            commitOnChangeEnd={false}
            onChange={(next) => props.onForceChange({ [key]: next })}
            formatValue={(next) =>
              key === 'chargeStrength'
                ? String(Math.abs(next))
                : key === 'linkDistance'
                  ? String(next)
                  : next.toFixed(2)
            }
          />
        )
      })}
      {props.onReplayLayout || props.onResetGraphSettings ? (
        <View style={{ flexDirection: 'row', gap: tokens.spacing.md, justifyContent: 'flex-end' }}>
          {props.onReplayLayout ? (
            <Button size="sm" onPress={props.onReplayLayout}>
              {t('graph.replay_layout', '重新布局')}
            </Button>
          ) : null}
          {props.onResetGraphSettings ? (
            <Button size="sm" onPress={props.onResetGraphSettings}>
              {t('graph.force_reset', '恢复默认')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
