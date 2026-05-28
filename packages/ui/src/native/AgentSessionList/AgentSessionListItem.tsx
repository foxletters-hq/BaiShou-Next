import React, { useCallback } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { AgentSession } from './agent-session-list.types'
import { formatSessionTime } from './agent-session-list.utils'
import { agentSessionListStyles as styles } from './agent-session-list.styles'

interface AgentSessionListItemProps {
  item: AgentSession
  onSelect: (id: string) => void
  onPin?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
}

export const AgentSessionListItem: React.FC<AgentSessionListItemProps> = ({
  item,
  onSelect,
  onPin,
  onDelete,
  onRename
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('agent.sessions.delete_title', '删除对话'),
      t('agent.delete_session_confirm', '您确定要永久删除这篇对话吗？此操作不可逆转。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => onDelete?.(item.id)
        }
      ]
    )
  }, [item.id, onDelete, t])

  const handleRename = useCallback(() => {
    Alert.prompt(
      t('agent.sessions.rename', '重命名'),
      t('agent.sessions.rename_hint', '输入新会话名称'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确认'),
          onPress: (text?: string) => {
            if (text?.trim()) onRename?.(item.id, text.trim())
          }
        }
      ],
      'plain-text',
      item.title
    )
  }, [item.id, item.title, onRename, t])

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
      onLongPress={() => {
        const buttons: Array<{ text: string; onPress?: () => void }> = []
        if (onPin) {
          buttons.push({
            text: item.isPinned
              ? t('agent.sessions.unpin', '取消置顶')
              : t('agent.sessions.pin', '置顶对话'),
            onPress: () => onPin(item.id)
          })
        }
        if (onRename) {
          buttons.push({ text: t('agent.sessions.rename', '重命名'), onPress: handleRename })
        }
        if (onDelete) {
          buttons.push({ text: t('common.delete', '删除'), onPress: handleDelete })
        }
        buttons.push({ text: t('common.cancel', '取消') })
        Alert.alert(item.title, undefined, buttons)
      }}
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
