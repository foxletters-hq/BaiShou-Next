import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight } from 'lucide-react-native'
import {
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  parseMountedNotebookIds
} from '@baishou/shared'
import { DEFAULT_STROKE_WIDTH, useNativeTheme } from '@baishou/ui/native'
import { iconSizes, mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { mobileListMountSummaries } from '../../../services/mobile-knowledge.service'
import { agentDbRuntimeRef } from '../../../services/mobile-agent-db-runtime-ref'

export function KnowledgeMountHintBar(props: {
  sessionId?: string | null
  assistantId?: string | null
  refreshToken?: boolean
  hasChatBackground?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const [names, setNames] = useState<string[]>([])
  const draft = isDraftNotebookMountSessionId(props.sessionId)
  const pendingKey = notebookMountPendingKey({
    sessionId: props.sessionId,
    assistantId: props.assistantId,
    scope: 'companion'
  })

  const refresh = useCallback(async () => {
    const candidates = await mobileListMountSummaries()
    const selected = draft
      ? getPendingMountedNotebookIds(pendingKey)
      : parseMountedNotebookIds(
          props.sessionId
            ? (await agentDbRuntimeRef.current?.sessionRepo.getSessionById(props.sessionId))
                ?.mountedNotebookIds
            : undefined
        )
    setNames(
      selected
        .map((id) => candidates.find((row) => row.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    )
  }, [draft, pendingKey, props.sessionId])

  useEffect(() => {
    void refresh().catch(() => setNames([]))
  }, [refresh, props.refreshToken])

  if (names.length === 0) return null

  const label = t('agent.mounted_notebooks_count', '已挂载 {{count}} 本', {
    count: names.length,
    defaultValue: t('agent.mounted_notebooks', '已挂载 {{count}} 本', {
      count: names.length,
      names: names.join('、')
    })
  })

  return (
    <View style={styles.container}>
      <Pressable
        onPress={props.onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: pressed
              ? props.hasChatBackground
                ? isDark
                  ? 'rgba(255, 255, 255, 0.16)'
                  : 'rgba(255, 255, 255, 0.88)'
                : colors.bgSurfaceHigh
              : props.hasChatBackground
                ? isDark
                  ? 'rgba(30, 30, 34, 0.80)'
                  : 'rgba(255, 255, 255, 0.82)'
                : colors.bgSurface,
            borderColor: props.hasChatBackground
              ? isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.08)'
              : colors.borderControl
          }
        ]}
      >
        <BookOpen size={iconSizes.sm} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
        <ChevronRight
          size={iconSizes.xs}
          color={colors.textTertiary}
          strokeWidth={DEFAULT_STROKE_WIDTH}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.xs,
    alignItems: 'flex-start'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.full,
    borderWidth: 1,
    maxWidth: '100%'
  },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  }
})
