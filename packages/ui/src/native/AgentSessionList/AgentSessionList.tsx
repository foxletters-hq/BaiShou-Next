import React, { useState, useMemo } from 'react'
import { View, Text, Pressable, FlatList, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { AgentSessionListProps } from './agent-session-list.types'
export type { AgentSession, AgentSessionListProps } from './agent-session-list.types'
import { groupSessionsByTime } from './agent-session-list.utils'
import { agentSessionListStyles as styles } from './agent-session-list.styles'
import { AgentSessionListItem } from './AgentSessionListItem'

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

  const groupedSessions = useMemo(() => groupSessionsByTime(filteredSessions), [filteredSessions])

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderSubtle }
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
        renderItem={({ item: group }) => (
          <View>
            <View style={[styles.groupHeader, { backgroundColor: colors.bgApp }]}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
                {group.label}
              </Text>
            </View>
            {group.items.map((session) => (
              <AgentSessionListItem
                key={session.id}
                item={session}
                onSelect={onSelect}
                onPin={onPin}
                onDelete={onDelete}
                onRename={onRename}
              />
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
