import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Settings } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatGraphMonth, parseGraphMonthToDate } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphForceWebView } from './GraphForceWebView'
import { GraphMonthRangeSheet } from './GraphMonthRangeSheet'
import { GraphCanvasNodePeek } from './GraphCanvasNodePeek'
import { GraphScreenSettingsSheet } from './GraphScreenSettingsSheet'
import { styles } from './GraphScreen.styles'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useGraphCanvasModel } from './useGraphCanvasModel'
import { GRAPH_FILTER_NODE_TYPES } from './graph-screen-display.util'
import { requestGraphOpsNodeFocus } from './graph-cross-page-focus'

export function GraphCanvasScreen() {
  const m = useGraphCanvasModel()
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const chrome = getStackScreenChrome(colors)
  const router = useRouter()
  const { settings, search } = m

  useEffect(() => {
    if (m.selfNameReady === false) router.replace('/graph')
  }, [m.selfNameReady, router])

  const openInOps = (id: string) => {
    requestGraphOpsNodeFocus(id)
    if (router.canGoBack()) router.back()
    else router.replace('/graph')
  }

  return (
    <StackScreenLayout
      title={t('graph.title', '人生关系图')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <View style={[styles.graphBody, { paddingBottom: insets.bottom }]}>
        <View style={styles.toolbarRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <GraphMonthRangeSheet value={settings.monthRange} onChange={m.updateMonthRange} />
          </View>
          <Pressable
            onPress={search.clearToGlobal}
            accessibilityRole="button"
            accessibilityLabel={t('graph.global_view', '全局')}
            accessibilityHint={t(
              'graph.global_view_hint',
              '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
            )}
            style={[
              styles.toolBtn,
              {
                borderColor: colors.borderSubtle,
                backgroundColor: colors.bgSurfaceNormal
              }
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.meta.fontSize,
                fontWeight: settingsTypography.meta.fontWeight
              }}
            >
              {t('graph.global_view', '全局')}
            </Text>
          </Pressable>
        </View>

        {m.showMonthEmpty ? (
          <View style={styles.guide}>
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
              {t('graph.month_empty_title', '这个月份范围内还没有关系')}
            </Text>
            <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
              {t(
                'graph.month_empty_body',
                '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
                {
                  start: settings.monthRange.startMonth,
                  end: settings.monthRange.endMonth
                }
              )}
            </Text>
            <View style={styles.row}>
              <Pressable onPress={m.resetMonthRange}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {t('graph.month_range_recent3', '近3月')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const start = parseGraphMonthToDate(settings.monthRange.startMonth)
                  start.setMonth(start.getMonth() - 12)
                  m.updateMonthRange({
                    startMonth: formatGraphMonth(start),
                    endMonth: settings.monthRange.endMonth
                  })
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {t('graph.month_range_earlier', '再往前一年')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.webWrap, { backgroundColor: colors.bgApp }]}>
            <GraphForceWebView
              nodes={m.displayNodes.map((n) => ({
                id: n.id,
                name: n.name ?? '',
                discriminator: n.discriminator,
                nodeType: n.nodeType ?? 'person',
                mentionCount: n.mentionCount,
                reviewStatus: n.reviewStatus
              }))}
              edges={m.displayEdges.map((e) => ({
                id: e.id,
                fromId: e.fromId,
                toId: e.toId,
                edgeType: e.edgeType ?? '',
                reviewStatus: e.reviewStatus
              }))}
              forceSettings={settings.forceSettings}
              appearanceSettings={settings.appearanceSettings}
              selectedId={search.selectedId}
              focusIds={m.focusIds}
              highlightIds={search.highlightIds}
              highlightEdgeIds={search.highlightedEdgeIds}
              locateIds={search.locateIds}
              locateSeq={search.locateSeq}
              animationTick={m.animationTick}
              onSelectNode={(n) => m.onPeekNode(n.id)}
              onClearSelection={m.onClearPeek}
            />
            <Pressable
              onPress={() => settings.setSettingsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('graph.settings', '设置')}
              style={[
                styles.canvasSettingsFab,
                {
                  borderColor: settings.filterActive ? colors.primary : colors.borderMuted,
                  backgroundColor: colors.bgSurface
                }
              ]}
            >
              <Settings
                size={22}
                color={settings.filterActive ? colors.primary : colors.textPrimary}
                strokeWidth={2}
              />
            </Pressable>
            {m.peekNode ? (
              <GraphCanvasNodePeek
                name={String(m.peekNode.name || '')}
                discriminator={m.peekNode.discriminator}
                onOpenInOps={() => openInOps(m.peekNode.id)}
              />
            ) : null}
          </View>
        )}
      </View>

      <GraphScreenSettingsSheet
        visible={settings.settingsOpen}
        onClose={() => settings.setSettingsOpen(false)}
        mode="canvas"
        settingsSection={settings.settingsSection}
        onToggleSection={(key) => settings.setSettingsSection((s) => ({ ...s, [key]: !s[key] }))}
        canvas={{
          filterActive: settings.filterActive,
          typeFilterActive: settings.typeFilterActive,
          hideEntry: settings.hideEntry,
          approvedOnly: settings.approvedOnly,
          enabledNodeTypes: settings.enabledNodeTypes,
          filterNodeTypes: GRAPH_FILTER_NODE_TYPES,
          onHideEntryChange: settings.setHideEntry,
          onApprovedOnlyChange: settings.setApprovedOnly,
          onResetFilters: settings.resetFilters,
          onToggleTypeFilter: settings.toggleNodeTypeFilter,
          onToggleAllTypes: () =>
            settings.setEnabledNodeTypes(
              settings.typeFilterActive ? new Set(GRAPH_FILTER_NODE_TYPES) : new Set()
            ),
          focusDepth: search.focusDepth,
          onFocusDepthChange: search.updateFocusDepth,
          appearanceSettings: settings.appearanceSettings,
          onAppearanceChange: settings.updateAppearance,
          viewMaxNodes: settings.viewMaxNodes,
          onViewMaxNodesChange: settings.updateViewMaxNodes,
          forceSettings: settings.forceSettings,
          onForceChange: settings.updateForce,
          onReplayLayout: () => m.setAnimationTick((n) => n + 1),
          onResetGraphSettings: settings.resetGraphSettings
        }}
      />
    </StackScreenLayout>
  )
}
