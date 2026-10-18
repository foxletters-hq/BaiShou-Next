import React from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Settings } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  type GraphAppearanceSettings,
  type GraphForceSettings,
  type GraphMonthRange
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphCanvasNodePeek } from './GraphCanvasNodePeek'
import { GraphForceWebView } from './GraphForceWebView'
import { GraphMonthRangeSheet } from './GraphMonthRangeSheet'
import { graphScreenSectionStyles } from './graph-screen-section.styles'
import { toGraphForceEdges, toGraphForceNodes } from './graph-screen-display.util'
import type { GraphScreenEdge, GraphScreenNode } from './graph-screen.types'

export function GraphScreenCanvasPane(props: {
  nodes: GraphScreenNode[]
  edges: GraphScreenEdge[]
  forceSettings: GraphForceSettings
  appearanceSettings: GraphAppearanceSettings
  selectedId?: string | null
  focusIds?: Set<string>
  highlightIds?: Set<string>
  highlightEdgeIds?: Set<string>
  locateIds?: string[] | null
  locateSeq?: number
  animationTick?: number
  monthRange: GraphMonthRange
  onMonthRangeChange: (next: GraphMonthRange) => void
  monthEmpty?: boolean
  onSelectNode: (id: string) => void
  onClearSelection: () => void
  peekName?: string
  peekDiscriminator?: string | null
  onOpenPeekDetail: () => void
  onOpenSettings: () => void
  settingsActive?: boolean
  style?: ViewStyle
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const settingsSize = (graphScreenSectionStyles.fieldControl.height as number) || 34

  return (
    <View
      style={[
        canvasStyles.wrap,
        {
          borderRadius: tokens.radius.lg,
          backgroundColor: colors.bgApp,
          borderColor: colors.borderControl,
          marginHorizontal: tokens.spacing.md,
          marginBottom: tokens.spacing.sm
        },
        props.style
      ]}
    >
      <View collapsable={false} style={{ flex: 1 }}>
        {props.monthEmpty ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: tokens.spacing.lg,
              gap: tokens.spacing.sm
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {t('graph.month_empty_title', '这个月份范围内还没有关系')}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {t(
                'graph.month_empty_body',
                '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
                {
                  start: props.monthRange.startMonth,
                  end: props.monthRange.endMonth
                }
              )}
            </Text>
          </View>
        ) : (
          <GraphForceWebView
            nodes={toGraphForceNodes(props.nodes)}
            edges={toGraphForceEdges(props.edges)}
            forceSettings={props.forceSettings}
            appearanceSettings={props.appearanceSettings}
            selectedId={props.selectedId}
            focusIds={props.focusIds}
            highlightIds={props.highlightIds}
            highlightEdgeIds={props.highlightEdgeIds}
            locateIds={props.locateIds}
            locateSeq={props.locateSeq}
            animationTick={props.animationTick}
            onSelectNode={(node) => props.onSelectNode(node.id)}
            onClearSelection={props.onClearSelection}
          />
        )}
      </View>
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: tokens.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderControl
        }}
      />
      <View
        pointerEvents="box-none"
        style={[
          canvasStyles.overlay,
          {
            top: tokens.spacing.sm,
            left: tokens.spacing.sm,
            right: tokens.spacing.sm,
            gap: tokens.spacing.sm
          }
        ]}
      >
        <GraphMonthRangeSheet
          value={props.monthRange}
          onChange={props.onMonthRangeChange}
          style={{ flex: 1, minWidth: 0, alignSelf: 'stretch' }}
        />
        <Pressable
          onPress={props.onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={t('graph.settings', '设置')}
          style={[
            canvasStyles.settingsBtn,
            {
              width: settingsSize,
              height: settingsSize,
              borderRadius: tokens.radius.sm,
              borderColor: props.settingsActive ? colors.primary : colors.borderControl,
              backgroundColor: colors.bgSurface
            }
          ]}
        >
          <Settings
            size={18}
            color={props.settingsActive ? colors.primary : colors.textPrimary}
            strokeWidth={2}
          />
        </Pressable>
      </View>
      {props.peekName ? (
        <GraphCanvasNodePeek
          name={props.peekName}
          discriminator={props.peekDiscriminator}
          onOpenDetail={props.onOpenPeekDetail}
          style={{ bottom: tokens.spacing.xl + tokens.spacing.lg }}
        />
      ) : null}
    </View>
  )
}

const canvasStyles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1
  },
  overlay: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingsBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
