import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ToolExecution } from './streaming-bubble.types'
import { CollapsibleAncillaryBlock } from '../CollapsibleAncillaryBlock'
import { useNativeTheme } from '../theme'

function ActiveToolRow({ name }: { name: string }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev === '...' ? '.' : prev + '.'))
    }, 600)
    return () => clearInterval(timer)
  }, [])

  return (
    <View style={styles.toolItem}>
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      <Text style={[styles.activeToolName, { color: colors.primary }]} numberOfLines={1}>
        {t(`agent.tools.${name}`, name)}
        {dots}
      </Text>
    </View>
  )
}

/** 对齐 desktop StreamingBubble ToolExecutionGroup */
export function StreamingBubbleToolExecution({
  completedTools,
  activeToolName
}: {
  completedTools: ToolExecution[]
  activeToolName: string | null
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const hasTools = completedTools.length > 0 || !!activeToolName
  if (!hasTools) return null

  const totalTools = completedTools.length + (activeToolName ? 1 : 0)
  const title =
    activeToolName && completedTools.length === 0
      ? t('agent.tools.tool_call', '工具调用')
      : t('agent.tools.tool_call_results', '工具调用 · {{count}} 个结果', {
          count: totalTools
        })

  return (
    <CollapsibleAncillaryBlock
      headerIcon="🎧"
      title={title}
      open
      collapsible={false}
      inlineBody
      bodyPadding={false}
      onToggle={() => {}}
    >
      <View style={styles.toolList}>
        {completedTools.map((tool, idx) => {
          const durationText =
            tool.durationMs < 1000
              ? `${tool.durationMs}ms`
              : `${(tool.durationMs / 1000).toFixed(1)}s`
          return (
            <View key={`${tool.name}-${idx}`} style={styles.toolItem}>
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={[styles.toolItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                {t(`agent.tools.${tool.name}`, tool.name)}
              </Text>
              <Text style={[styles.toolItemDuration, { color: colors.textTertiary }]}>
                {durationText}
              </Text>
            </View>
          )
        })}
        {activeToolName ? <ActiveToolRow name={activeToolName} /> : null}
      </View>
    </CollapsibleAncillaryBlock>
  )
}

const styles = StyleSheet.create({
  toolList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  checkIcon: {
    fontSize: 14
  },
  toolItemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500'
  },
  toolItemDuration: {
    fontSize: 10
  },
  spinner: {
    width: 14,
    height: 14
  },
  activeToolName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500'
  }
})
