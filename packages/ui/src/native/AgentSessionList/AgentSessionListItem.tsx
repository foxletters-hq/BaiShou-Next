import React, { useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { useDialog } from '../Dialog'
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
  const dialog = useDialog()

  const handleDelete = useCallback(async () => {
    const confirmed = await dialog.confirm(
      t('agent.delete_session_confirm', '您确定要永久删除这篇对话吗？此操作不可逆转。'),
      {
        confirmText: t('common.delete', '删除'),
        destructive: true
      }
    )
    if (confirmed) onDelete?.(item.id)
  }, [dialog, item.id, onDelete, t])

  const handleRename = useCallback(async () => {
    const text = await dialog.prompt(
      t('agent.sessions.rename_hint', '输入新会话名称'),
      item.title,
      t('agent.sessions.rename', '重命名')
    )
    if (text?.trim()) onRename?.(item.id, text.trim())
  }, [dialog, item.id, item.title, onRename, t])

  const handleLongPress = useCallback(async () => {
    const options: Array<{ label: string; value: string; destructive?: boolean }> = []
    if (onPin) {
      options.push({
        label: item.isPinned
          ? t('agent.sessions.unpin', '取消置顶')
          : t('agent.sessions.pin', '置顶对话'),
        value: 'pin'
      })
    }
    if (onRename) {
      options.push({ label: t('agent.sessions.rename', '重命名'), value: 'rename' })
    }
    if (onDelete) {
      options.push({
        label: t('common.delete', '删除'),
        value: 'delete',
        destructive: true
      })
    }
    if (options.length === 0) return

    const choice = await dialog.choose(
      undefined,
      options,
      item.title || t('agent.sessions.default_title', '新对话')
    )
    if (choice === 'pin') onPin?.(item.id)
    else if (choice === 'rename') await handleRename()
    else if (choice === 'delete') await handleDelete()
  }, [dialog, handleDelete, handleRename, item, onDelete, onPin, onRename, t])

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
      onLongPress={() => void handleLongPress()}
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
