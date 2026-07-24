import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { selectGroupedPending, selectPendingCount, useAgentGateInboxStore } from '@baishou/store'
import { useNativeTheme } from '@baishou/ui/native'

export interface AgentGatePendingListProps {
  currentSessionId?: string | null
  onSelect: (sessionId: string, requestId: string) => void
}

/** Agent 页待确认列表：跨会话分组，点击切换会话并聚焦请求 */
export const AgentGatePendingList: React.FC<AgentGatePendingListProps> = ({
  currentSessionId,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const count = useAgentGateInboxStore(selectPendingCount)
  const groups = useAgentGateInboxStore(selectGroupedPending)

  if (count <= 0) return null

  return (
    <View
      style={[styles.wrap, { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('agent_gate.pending_list_title', '待确认 · {{count}}', { count })}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {groups.flatMap((group) =>
          group.requests.map((request) => {
            const active = request.sessionId === currentSessionId
            return (
              <Pressable
                key={request.id}
                onPress={() => {
                  useAgentGateInboxStore.getState().setFocusedRequest(request.sessionId, request.id)
                  onSelect(request.sessionId, request.id)
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.primary : colors.borderSubtle,
                    backgroundColor: active ? colors.primaryLight : colors.bgApp
                  }
                ]}
              >
                <Text style={[styles.chipTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {request.title}
                </Text>
                <Text style={[styles.chipMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {request.sessionId === currentSessionId
                    ? t('agent_gate.pending_current_session', '当前会话')
                    : t('agent_gate.pending_other_session', '其他会话')}
                </Text>
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  title: {
    fontSize: 12,
    fontWeight: '600'
  },
  row: {
    gap: 8,
    paddingRight: 8
  },
  chip: {
    maxWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  chipTitle: {
    fontSize: 12,
    fontWeight: '600'
  },
  chipMeta: {
    fontSize: 10
  }
})
