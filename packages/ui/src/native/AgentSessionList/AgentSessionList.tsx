import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  StyleSheet,
  Alert
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AgentSession {
  id: string
  title: string
  lastMessageAt: number
  isPinned: boolean
  messageCount: number
}

export interface AgentSessionListProps {
  sessions: AgentSession[]
  onSelect: (id: string) => void
  onPin?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
}

type TimeGroup = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'earlier'

const getTimeGroup = (timestamp: number, isPinned: boolean): TimeGroup => {
  if (isPinned) return 'pinned'
  const now = new Date()
  const date = new Date(timestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000)

  if (date >= startOfToday) return 'today'
  if (date >= startOfYesterday) return 'yesterday'
  if (date >= startOfWeek) return 'thisWeek'
  return 'earlier'
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

const groupOrder: TimeGroup[] = ['pinned', 'today', 'yesterday', 'thisWeek', 'earlier']

const groupLabels: Record<TimeGroup, string> = {
  pinned: '置顶',
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  earlier: '更早'
}

export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  onSelect,
  onPin,
  onDelete,
  onRename
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter((s) => s.title.toLowerCase().includes(query))
  }, [sessions, searchQuery])

  const groupedSessions = useMemo(() => {
    const groups: Record<TimeGroup, AgentSession[]> = {
      pinned: [],
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: []
    }

    for (const session of filteredSessions) {
      const group = getTimeGroup(session.lastMessageAt, session.isPinned)
      groups[group].push(session)
    }

    return groupOrder
      .filter((g) => groups[g].length > 0)
      .map((g) => ({ group: g, label: groupLabels[g], items: groups[g]! }))
  }, [filteredSessions])

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        t('session.deleteConfirm', '确认删除'),
        t('session.deleteMessage', '确定要删除该会话吗？此操作不可撤销。'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.delete', '删除'),
            style: 'destructive',
            onPress: () => onDelete?.(id)
          }
        ]
      )
    },
    [onDelete, t]
  )

  const handleRename = useCallback(
    (id: string, currentTitle: string) => {
      Alert.prompt(
        t('session.rename', '重命名'),
        t('session.renameHint', '请输入新的会话名称'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.confirm', '确认'),
            onPress: (text?: string) => {
              if (text && text.trim()) {
                onRename?.(id, text.trim())
              }
            }
          }
        ],
        'plain-text',
        currentTitle
      )
    },
    [onRename, t]
  )

  const renderItem = ({ item }: { item: AgentSession }) => (
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
          buttons.push({
            text: t('session.rename', '重命名'),
            onPress: () => handleRename(item.id, item.title)
          })
        }
        if (onDelete) {
          buttons.push({
            text: t('common.delete', '删除'),
            onPress: () => handleDelete(item.id)
          })
        }
        buttons.push({ text: t('common.cancel', '取消') })
        Alert.alert(item.title, undefined, buttons)
      }}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
          <Text
            style={[styles.itemTitle, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.title || t('session.newSession', '新对话')}
          </Text>
        </View>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
            {formatTime(item.lastMessageAt)}
          </Text>
          <Text style={[styles.itemCount, { color: colors.textTertiary }]}>
            {item.messageCount} {t('session.messages', '条消息')}
          </Text>
        </View>
      </View>
    </Pressable>
  )

  const renderGroupHeader = (label: string) => (
    <View style={[styles.groupHeader, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle
          }
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          placeholder={t('session.search', '搜索会话...')}
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: colors.textPrimary }]}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>×</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={groupedSessions}
        keyExtractor={(item) => item.group}
        renderItem={({ item }) => (
          <View>
            {renderGroupHeader(item.label)}
            {item.items.map((session) => (
              <View key={session.id}>{renderItem({ item: session })}</View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('session.noSessions', '暂无会话')}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15
  },
  clearIcon: {
    fontSize: 18,
    paddingHorizontal: 6
  },
  groupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  itemContent: {
    flex: 1
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  pinIcon: {
    fontSize: 13,
    marginRight: 4
  },
  itemTitle: {
    fontSize: 16,
    flex: 1
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemTime: {
    fontSize: 12
  },
  itemCount: {
    fontSize: 12
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 15
  }
})
