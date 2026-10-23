import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CircleX, ShieldCheck } from 'lucide-react-native'
import {
  AgentGateReply,
  shouldRenderAgentGateHistoryCard,
  type AgentGatePartData,
  type AgentGateRequest
} from '@baishou/shared'
import { summarizePreviewForHistory } from '../../agent-gate/agent-gate-preview-copy'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { ThinkChevron } from '../AgentThinkSection/ThinkStatusIcon'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface AgentGatePartCardProps {
  data: AgentGatePartData
}

function replyLabel(t: (key: string, fallback: string) => string, reply?: AgentGateReply): string {
  switch (reply) {
    case AgentGateReply.Once:
      return t('agent_gate.once', '本次允许')
    case AgentGateReply.Always:
      return t('agent_gate.always', '始终允许')
    case AgentGateReply.Reject:
      return t('agent_gate.reject', '拒绝')
    default:
      return t('agent_gate.pending_badge', '待确认')
  }
}

function selectedOptionLabel(
  request: AgentGateRequest,
  selectedOptionIds?: string[]
): string | null {
  if (!selectedOptionIds || selectedOptionIds.length === 0) return null
  const labels = selectedOptionIds
    .map((id) => request.options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label))
  return labels.length > 0 ? labels.join('、') : null
}

export const AgentGatePartCard: React.FC<AgentGatePartCardProps> = ({ data }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  if (!shouldRenderAgentGateHistoryCard(data)) return null

  const { request, resolution } = data
  const isRejected = resolution?.reply === AgentGateReply.Reject
  const optionLabel = selectedOptionLabel(request, resolution?.selectedOptionIds)
  const previewSummary = summarizePreviewForHistory(request.preview)
  const numberedOptionsText =
    request.options.length > 0
      ? request.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
      : null
  const descriptionIsOptionsDump =
    Boolean(request.description) && request.description?.trim() === numberedOptionsText
  const description =
    !request.preview &&
    request.description &&
    !descriptionIsOptionsDump &&
    request.description !== request.title &&
    !request.description.startsWith(`${request.title}：`) &&
    !request.description.startsWith(`${request.title}:`)
      ? request.description.trim()
      : null
  const preview = previewSummary && previewSummary !== request.title ? previewSummary : null
  const extra = [optionLabel, resolution?.message].filter(Boolean).join(' · ')
  const detail = [preview, description, extra].filter(Boolean).join('\n')
  const canExpand = detail.length > 0

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        disabled={!canExpand}
        onPress={canExpand ? () => setExpanded((prev) => !prev) : undefined}
        accessibilityRole="button"
        accessibilityState={{ expanded: canExpand ? expanded : undefined }}
      >
        <View style={styles.iconBox}>
          {isRejected ? (
            <CircleX size={15} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
          ) : (
            <ShieldCheck
              size={15}
              color={colors.textSecondary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          )}
        </View>
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {request.title}
        </Text>
        <Text style={[styles.sep, { color: colors.textTertiary }]}>·</Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
          {replyLabel(t, resolution?.reply)}
        </Text>
        {canExpand ? <ThinkChevron expanded={expanded} color={colors.textTertiary} /> : null}
      </Pressable>

      {canExpand ? (
        <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
          <View
            style={[
              styles.content,
              {
                borderLeftColor: colors.borderMuted
              }
            ]}
          >
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{detail}</Text>
          </View>
        </CollapsibleHeight>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 22
  },
  iconBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusText: {
    flexShrink: 0,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    fontWeight: '400'
  },
  sep: {
    flexShrink: 0,
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 20
  },
  subtitle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  content: {
    width: '100%',
    paddingLeft: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.xs,
    borderLeftWidth: 2
  },
  detailText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  }
})
