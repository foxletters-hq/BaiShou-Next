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
      t('session.deleteConfirm', '确认删除'),
      t('session.deleteMessage', '确定要删除该会话吗？此操作不可撤销。'),
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
      t('session.rename', '重命名'),
      t('session.renameHint', '请输入新的会话名称'),
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
            text: item.isPinned ? t('session.unpin', '取消置顶') : t('session.pin', '置顶'),
            onPress: () => onPin(item.id)
          })
        }
        if (onRename) {
          buttons.push({ text: t('session.rename', '重命名'), onPress: handleRename })
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
            {item.title || t('session.newSession', '新对话')}
          </Text>
        </View>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
            {formatSessionTime(item.lastMessageAt)}
          </Text>
          <Text style={[styles.itemCount, { color: colors.textTertiary }]}>
            {item.messageCount} {t('session.messages', '条消息')}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
