import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { AgentSession } from './agent-session-list.types'
import { formatSessionTime } from './agent-session-list.utils'
import { agentSessionListStyles as styles } from './agent-session-list.styles'

interface AgentSessionListItemProps {
  item: AgentSession
  onSelect: (id: string) => void
  onShowActions: (item: AgentSession) => void
}

export const AgentSessionListItem: React.FC<AgentSessionListItemProps> = ({
  item,
  onSelect,
  onShowActions
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed ? colors.bgSurfaceNormal : 'transparent',
          borderBottomColor: colors.borderSubtle
        }
      ]}
      onPress={() => onSelect(item.id)}
      onLongPress={() => onShowActions(item)}
      delayLongPress={400}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.title || t('agent.sessions.default_title', '新对话')}
          </Text>
        </View>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
            {formatSessionTime(item.lastMessageAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
