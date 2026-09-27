import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_APPEARANCE_RANGES,
  GRAPH_FORCE_RANGES,
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  GRAPH_VIEW_MAX_NODES_MAX,
  GRAPH_VIEW_MAX_NODES_MIN,
  GRAPH_VIEW_MAX_NODES_STEP,
  graphNodeTypeColor,
  graphViewMaxNodesSliderValue,
  isGraphViewMaxNodesUnlimited,
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings
} from '@baishou/shared'
import { NativeSlider, Switch, useNativeTheme } from '@baishou/ui/native'
import { GraphScreenDepthChips } from './GraphScreenDepthChips'
import { styles } from './GraphScreen.styles'
import type { GraphScreenSettingsSection } from './graph-screen.types'

export function GraphScreenSettingsCanvas(props: {
  settingsSection: GraphScreenSettingsSection
  onToggleAppearance: () => void
  onToggleForces: () => void
  filterActive: boolean
  typeFilterActive: boolean
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: Set<string>
  filterNodeTypes: string[]
  onHideEntryChange: (value: boolean) => void
  onApprovedOnlyChange: (value: boolean) => void
  onResetFilters: () => void
  onToggleTypeFilter: (nodeType: string) => void
  onToggleAllTypes: () => void
  focusDepth: GraphFocusDepth
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  appearanceSettings: GraphAppearanceSettings
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  viewMaxNodes: number
  onViewMaxNodesChange: (value: number) => void
  forceSettings: GraphForceSettings
  onForceChange: (patch: Partial<GraphForceSettings>) => void
  onReplayLayout: () => void
  onResetGraphSettings: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const renderDepthChips = () => (
    <GraphScreenDepthChips focusDepth={props.focusDepth} onChange={props.onFocusDepthChange} />
  )

  const renderForceSliders = () => (
    <>
      {(
        [
          ['centerStrength', 'graph.force_center'],
          ['linkStrength', 'graph.force_link'],
          ['chargeStrength', 'graph.force_charge'],
          ['linkDistance', 'graph.force_link_distance']
        ] as const
      ).map(([key, i18nKey]) => {
        const range = GRAPH_FORCE_RANGES[key]
        const value = props.forceSettings[key]
        return (
          <View key={key} style={styles.forceRow}>
            <Text style={[styles.forceLabel, { color: colors.textSecondary }]}>{t(i18nKey)}</Text>
            <View style={{ flex: 1 }}>
              <NativeSlider
                value={value}
                minValue={range.min}
                maxValue={range.max}
                step={range.step}
                onChange={(v) => props.onForceChange({ [key]: v })}
              />
            </View>
            <Text style={[styles.forceValue, { color: colors.textSecondary }]}>
              {key === 'chargeStrength'
                ? Math.abs(value)
                : key === 'linkDistance'
                  ? value
                  : value.toFixed(2)}
            </Text>
          </View>
        )
      })}
      <View style={styles.row}>
        <Pressable onPress={props.onReplayLayout}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {t('graph.relayout', '重新布局')}
          </Text>
        </Pressable>
        <Pressable onPress={props.onResetGraphSettings}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {t('graph.force_reset', '恢复默认')}
          </Text>
        </Pressable>
      </View>
    </>
  )

  return (
    <View style={styles.settingsBody}>
      <View style={styles.filterSectionHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
          {t('graph.filter', '筛选')}
        </Text>
        {props.filterActive ? (
          <Pressable onPress={props.onResetFilters}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
              {t('graph.filter_reset', '恢复默认')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
          {t('graph.hide_entry_anchors', '隐藏日记锚点')}
        </Text>
        <Switch value={props.hideEntry} onValueChange={props.onHideEntryChange} />
      </View>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
          {t('graph.approved_only', '只看已确认')}
        </Text>
        <Switch value={props.approvedOnly} onValueChange={props.onApprovedOnlyChange} />
      </View>
      <View style={styles.filterSectionHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
          {t('graph.filter_by_type', '按分类')}
        </Text>
        <Pressable onPress={props.onToggleAllTypes}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {props.typeFilterActive
              ? t('graph.filter_select_all_types', '全选')
              : t('graph.filter_clear_types', '清空')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.typeChipRow}>
        {props.filterNodeTypes.map((nodeType) => {
          const active = props.enabledNodeTypes.has(nodeType)
          const typeColor = graphNodeTypeColor(nodeType)
          return (
            <Pressable
              key={nodeType}
              onPress={() => props.onToggleTypeFilter(nodeType)}
              style={[
                styles.edgeTypeChip,
                {
                  backgroundColor: active ? typeColor : colors.bgSurfaceNormal,
                  borderColor: active ? typeColor : colors.borderSubtle
                }
              ]}
            >
              <Text
                style={{
                  color: active ? colors.textOnPrimary : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: active ? '700' : '500'
                }}
              >
                {t(
                  `graph.node_type.${nodeType}`,
                  GRAPH_NODE_TYPE_LABEL_FALLBACKS[nodeType] ?? nodeType
                )}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {renderDepthChips()}
      <Pressable onPress={props.onToggleAppearance} style={styles.settingsHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
          {props.settingsSection.appearance ? '▾ ' : '▸ '}
          {t('graph.appearance', '外观')}
        </Text>
      </Pressable>
      {props.settingsSection.appearance ? (
        <View style={styles.settingsBody}>
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
              {t('graph.show_arrows', '箭头')}
            </Text>
            <Switch
              value={props.appearanceSettings.showArrows}
              onValueChange={(v) => props.onAppearanceChange({ showArrows: v })}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
              {t('graph.show_isolated_nodes', '独立节点')}
            </Text>
            <Switch
              value={props.appearanceSettings.showIsolatedNodes}
              onValueChange={(v) => props.onAppearanceChange({ showIsolatedNodes: v })}
            />
          </View>
          <View style={styles.forceRow}>
            <Text
              style={[styles.forceLabelWide, { color: colors.textSecondary }]}
              accessibilityHint={t(
                'graph.max_nodes_hint',
                '画布最多取这么多个节点。滑到最右为不限制。这个月份里尚未确认的节点仍会补进来，以免漏看。'
              )}
            >
              {t('graph.max_nodes', '显示节点上限')}
            </Text>
            <View style={{ flex: 1 }}>
              <NativeSlider
                value={graphViewMaxNodesSliderValue(props.viewMaxNodes)}
                minValue={GRAPH_VIEW_MAX_NODES_MIN}
                maxValue={GRAPH_VIEW_MAX_NODES_MAX}
                step={GRAPH_VIEW_MAX_NODES_STEP}
                onChange={(v) => props.onViewMaxNodesChange(v)}
              />
            </View>
            <Text style={[styles.forceValue, { color: colors.textSecondary }]}>
              {isGraphViewMaxNodesUnlimited(props.viewMaxNodes)
                ? t('graph.max_nodes_unlimited', '无限')
                : props.viewMaxNodes}
            </Text>
          </View>
          {(
            [
              ['textOpacity', 'graph.text_opacity'],
              ['nodeSize', 'graph.node_size'],
              ['lineThickness', 'graph.line_thickness'],
              ['hubLabelMinDegree', 'graph.hub_label_degree'],
              ['hubLabelMinMentions', 'graph.hub_label_mentions']
            ] as const
          ).map(([key, i18nKey]) => {
            const range = GRAPH_APPEARANCE_RANGES[key]
            const value = props.appearanceSettings[key]
            return (
              <View key={key} style={styles.forceRow}>
                <Text style={[styles.forceLabelWide, { color: colors.textSecondary }]}>
                  {t(i18nKey)}
                </Text>
                <View style={{ flex: 1 }}>
                  <NativeSlider
                    value={value}
                    minValue={range.min}
                    maxValue={range.max}
                    step={range.step}
                    onChange={(v) => props.onAppearanceChange({ [key]: v })}
                  />
                </View>
                <Text style={[styles.forceValue, { color: colors.textSecondary }]}>
                  {typeof value === 'number' && !Number.isInteger(range.step)
                    ? value.toFixed(2)
                    : value}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}

      <Pressable onPress={props.onToggleForces} style={styles.settingsHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
          {props.settingsSection.forces ? '▾ ' : '▸ '}
          {t('graph.force_layout', '布局力')}
        </Text>
      </Pressable>
      {props.settingsSection.forces ? (
        <View style={styles.settingsBody}>{renderForceSliders()}</View>
      ) : null}
    </View>
  )
}
