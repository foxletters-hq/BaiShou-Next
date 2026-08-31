import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatToolDurationMs, type AgentToolChainItemModel } from '../../shared/agent-tool-chain'
import {
  getToolDisplayName,
  getToolRowSubtitle,
  resolveCompanionAskPresentation,
  type ToolInvocationLike
} from '../../shared/tool-result.util'
import { ThinkChevron, ToolStatusIcon } from '../AgentThinkSection/ThinkStatusIcon'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { useNativeTheme } from '../theme'
import { CompanionAskResultCard } from './CompanionAskResultCard'
import { ToolResultContent } from './ToolResultContent'

export interface AgentToolThinkItemProps {
  model: AgentToolChainItemModel
  autoExpand?: boolean
}

export const AgentToolThinkItem = React.memo(function AgentToolThinkItem({
  model,
  autoExpand = false
}: AgentToolThinkItemProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  const [contentMounted, setContentMounted] = useState(false)

  const isLoading = model.status === 'loading'
  const invocation = model.invocation as ToolInvocationLike | undefined
  const askPresentation = useMemo(() => {
    if (!invocation || isLoading || model.status === 'error') return null
    return resolveCompanionAskPresentation(invocation)
  }, [invocation, isLoading, model.status])
  const canExpand = Boolean(model.hasContent && invocation && !isLoading && !askPresentation)

  useEffect(() => {
    if (autoExpand && canExpand) {
      setContentMounted(true)
      setExpanded(true)
    }
  }, [autoExpand, canExpand])

  const displayTitle = useMemo(() => {
    if (invocation != null) {
      return getToolDisplayName(invocation, (key, fallback) =>
        String(t(key, { defaultValue: fallback ?? key }))
      )
    }
    return t(`agent.tools.${model.toolName}`, model.toolName)
  }, [invocation, model.toolName, t])

  const subtitle = useMemo(
    () => getToolRowSubtitle(invocation, model.status, t),
    [invocation, model.status, t]
  )

  const handleToggle = useCallback(() => {
    if (!canExpand) return
    setExpanded((prev) => {
      const next = !prev
      if (next) setContentMounted(true)
      return next
    })
  }, [canExpand])

  if (askPresentation) {
    return <CompanionAskResultCard data={askPresentation} />
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        onPress={canExpand ? handleToggle : undefined}
        disabled={!canExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded: canExpand ? expanded : undefined }}
      >
        <ToolStatusIcon
          loading={isLoading}
          status={model.status}
          color={colors.textSecondary}
          errorColor={colors.error}
        />
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {displayTitle}
        </Text>
        {subtitle ? (
          <>
            <Text style={[styles.sep, { color: colors.textTertiary }]}>·</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </>
        ) : (
          <View style={styles.spacer} />
        )}
        {model.durationMs != null ? (
          <Text style={[styles.duration, { color: colors.textTertiary }]}>
            {formatToolDurationMs(model.durationMs)}
          </Text>
        ) : null}
        {canExpand ? <ThinkChevron expanded={expanded} color={colors.textTertiary} /> : null}
      </Pressable>

      {canExpand && invocation && contentMounted ? (
        <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
          <View
            style={[
              styles.content,
              {
                borderLeftColor: colors.borderMuted,
                paddingTop: 8
              }
            ]}
          >
            <ToolResultContent invocation={invocation} />
          </View>
        </CollapsibleHeight>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    width: '100%'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 22
  },
  statusText: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400'
  },
  sep: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 20
  },
  subtitle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 20
  },
  spacer: {
    flex: 1
  },
  duration: {
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  content: {
    width: '100%',
    paddingLeft: 12,
    borderLeftWidth: 2
  }
})
