import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ToolExecution } from './streaming-bubble.types'
import type { useNativeTheme } from '../theme'

export function StreamingBubbleToolExecution({
  completedTools,
  activeToolName,
  colors,
  tokens
}: {
  completedTools: ToolExecution[]
  activeToolName: string | null
  colors: ReturnType<typeof useNativeTheme>['colors']
  tokens: ReturnType<typeof useNativeTheme>['tokens']
}) {
  const { t } = useTranslation()
  const hasTools = completedTools.length > 0 || !!activeToolName
  if (!hasTools) return null

  const totalTools = completedTools.length + (activeToolName ? 1 : 0)

  return (
    <View
      style={{
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.md,
        padding: tokens.spacing.sm,
        marginBottom: tokens.spacing.sm
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: tokens.spacing.xs,
          gap: tokens.spacing.xs
        }}
      >
        <Text style={{ fontSize: 14 }}>🎧</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
          {t('agent.tools.tool_call', '工具调用')}
        </Text>
        <View
          style={{
            backgroundColor: colors.primaryContainer,
            borderRadius: tokens.radius.full,
            paddingHorizontal: 8,
            paddingVertical: 2
          }}
        >
          <Text style={{ fontSize: 12, color: colors.onPrimaryContainer }}>
            {completedTools.length}/{totalTools}
          </Text>
        </View>
      </View>

      {completedTools.map((tool, idx) => {
        const durationText =
          tool.durationMs < 1000
            ? `${tool.durationMs}ms`
            : `${(tool.durationMs / 1000).toFixed(1)}s`
        return (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              paddingVertical: 4
            }}
          >
            <Text style={{ fontSize: 14 }}>✅</Text>
            <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>
              {t(`agent.tools.${tool.name}`, tool.name)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{durationText}</Text>
          </View>
        )
      })}

      {activeToolName && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            paddingVertical: 4
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 14, color: colors.primary }}>
            {t(`agent.tools.${activeToolName}`, activeToolName)} ...
          </Text>
        </View>
      )}
    </View>
  )
}
