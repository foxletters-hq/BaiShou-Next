import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AgentGateReply,
  type AgentGatePartData,
  type AgentGateRequest
} from '@baishou/shared'
import { useNativeTheme } from '../theme'

export interface AgentGatePartCardProps {
  data: AgentGatePartData
}

function replyLabel(
  t: (key: string, fallback: string) => string,
  reply?: AgentGateReply
): string {
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

function selectedOptionLabel(request: AgentGateRequest, selectedOptionIds?: string[]): string | null {
  const selectedId = selectedOptionIds?.[0]
  if (!selectedId) return null
  return request.options.find((option) => option.id === selectedId)?.label ?? null
}

export const AgentGatePartCard: React.FC<AgentGatePartCardProps> = ({ data }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { request, resolution } = data
  const resolved = Boolean(resolution)
  const optionLabel = selectedOptionLabel(request, resolution?.selectedOptionIds)

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.borderSubtle,
          backgroundColor: 'rgba(91, 168, 245, 0.08)'
        }
      ]}
    >
      <Text style={[styles.badge, { color: colors.primary }]}>
        {resolved
          ? t('agent_gate.resolved_badge', '已确认')
          : t('agent_gate.pending_badge', '待确认')}
      </Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{request.title}</Text>
      {request.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{request.description}</Text>
      ) : null}
      {resolved ? (
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {replyLabel(t, resolution?.reply)}
          {optionLabel ? ` · ${optionLabel}` : ''}
          {resolution?.message ? ` · ${resolution.message}` : ''}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6
  },
  title: {
    fontSize: 14,
    fontWeight: '600'
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19
  },
  meta: {
    marginTop: 8,
    fontSize: 12
  }
})
