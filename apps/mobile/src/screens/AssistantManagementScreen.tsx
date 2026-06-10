import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  Input,
  AssistantAvatar
} from '@baishou/ui/native'
import {
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { syncSettingsAssistantsToRepo } from '../services/mobile-assistant-sync.service'

interface Assistant {
  id: string
  name: string
  emoji: string
  description?: string
  systemPrompt?: string
  isDefault: boolean
  isPinned: boolean
  providerId?: string
  modelId?: string
  avatarPath?: string
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
  displayAvatarUri?: string
}

export const AssistantManagementScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { width } = useWindowDimensions()
  const { services, dbReady } = useBaishou()
  const router = useRouter()

  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const numColumns = width >= 520 ? 2 : 1

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const assistantList = (await services.settingsManager.get<Assistant[]>('assistants')) || []
      const withAvatars = await Promise.all(
        assistantList.map(async (a) => {
          let displayAvatarUri: string | undefined
          if (
            a.avatarPath &&
            !isDefaultAssistantAvatarPath(a.avatarPath) &&
            isAssistantAvatarRelativePath(a.avatarPath)
          ) {
            try {
              displayAvatarUri = await services.attachmentManager.resolveAvatarPath(a.avatarPath)
            } catch {
              displayAvatarUri = undefined
            }
          } else if (a.avatarPath && isAssistantAvatarDirectUri(a.avatarPath)) {
            displayAvatarUri = a.avatarPath
          }
          return { ...a, displayAvatarUri }
        })
      )
      setAssistants(withAvatars)
    } catch (e) {
      console.error('Failed to load assistants', e)
    } finally {
      setLoading(false)
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants])

  useFocusEffect(
    useCallback(() => {
      void loadAssistants()
    }, [loadAssistants])
  )

  const processedAssistants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = [...assistants]
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q))
      )
    }
    return list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
  }, [assistants, searchQuery])

  const handleCreateAssistant = () => {
    router.push('/settings/assistant-edit?id=new')
  }

  const handleEditAssistant = (assistant: Assistant) => {
    router.push(`/settings/assistant-edit?id=${encodeURIComponent(assistant.id)}`)
  }

  const handleDeleteAssistant = async (assistant: Assistant) => {
    const confirmed = await dialog.confirm(
      t(
        'agent.assistant.delete_confirm_content',
        '确认要永久销毁此智能体的全部数据吗？一旦抹除将不可撤销。'
      ),
      {
        title: t('agent.assistant.delete_confirm_title', '特级警告：抹除心智模式？'),
        confirmText: t('common.delete', '删除'),
        destructive: true
      }
    )
    if (!confirmed) return
    try {
      const newAssistants = assistants.filter((a) => a.id !== assistant.id)
      await services?.settingsManager.set('assistants', newAssistants)
      if (services) {
        await syncSettingsAssistantsToRepo(services.settingsManager, services.assistantManager)
      }
      setAssistants(newAssistants)
      toast.showSuccess(t('agent.assistant.deleted', '助手已删除'))
    } catch (e) {
      console.error('Failed to delete assistant', e)
      toast.showError(t('common.delete_failed', '删除失败'))
    }
  }

  const handleTogglePin = async (assistant: Assistant) => {
    try {
      const newAssistants = assistants.map((a) =>
        a.id === assistant.id ? { ...a, isPinned: !a.isPinned } : a
      )
      await services?.settingsManager.set('assistants', newAssistants)
      if (services) {
        await syncSettingsAssistantsToRepo(services.settingsManager, services.assistantManager)
      }
      setAssistants(newAssistants)
    } catch (e) {
      console.error('Failed to toggle pin', e)
    }
  }

  const renderCard = ({ item }: { item: Assistant }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: item.isPinned ? colors.primary : colors.borderSubtle,
          borderRadius: tokens.radius.lg
        },
        item.isPinned && { borderWidth: 1.5 }
      ]}
      onPress={() => handleEditAssistant(item)}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <AssistantAvatar
          emoji={item.emoji}
          avatarPath={item.avatarPath}
          resolvedAvatarUri={item.displayAvatarUri}
          size={44}
        />
        <View style={styles.cardMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isPinned ? (
              <MaterialIcons name="push-pin" size={14} color={colors.primary} />
            ) : null}
          </View>
          {item.isDefault ? (
            <Text style={[styles.defaultTag, { color: colors.primary }]}>
              {t('assistant.default', '默认')}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.description ||
          item.systemPrompt ||
          t('agent.assistant.no_prompt', '⚠️ 空白系统协议流...')}
      </Text>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.chipBtn, { borderColor: colors.borderSubtle }]}
          onPress={() => void handleTogglePin(item)}
        >
          <MaterialIcons
            name="push-pin"
            size={16}
            color={item.isPinned ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
        {!item.isDefault ? (
          <TouchableOpacity
            style={[styles.chipBtn, { borderColor: colors.error + '55' }]}
            onPress={() => handleDeleteAssistant(item)}
          >
            <MaterialIcons name="delete-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  )

  return (
    <StackScreenLayout
      title={t('agent.assistant.title', '伙伴管理')}
      {...getStackScreenChrome(colors)}
      headerRight={{
        label: `+ ${t('agent.assistant.create_new', '新增伙伴')}`,
        onPress: handleCreateAssistant
      }}
      contentStyle={styles.container}
    >
      {loading ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
        </View>
      ) : assistants.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons
            name="auto-awesome"
            size={56}
            color={colors.primary}
            style={{ opacity: 0.65 }}
          />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('agent.assistant.empty_hint', '全列阵空爆：您的矩阵里还没有服役的心智')}
          </Text>
          <TouchableOpacity
            style={[styles.createFirstButton, { borderColor: colors.primary }]}
            onPress={handleCreateAssistant}
          >
            <MaterialIcons name="add" size={18} color={colors.primary} />
            <Text style={[styles.createFirstText, { color: colors.primary }]}>
              {t('agent.assistant.create_first', '执行首建协议')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={processedAssistants}
          renderItem={renderCard}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: colors.bgApp }}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          ListHeaderComponent={
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('common.search_hint', '搜索…')}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>{t('common.no_data')}</Text>
            </View>
          }
        />
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16
  },
  emptyTitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1
  },
  createFirstText: {
    fontSize: 15,
    fontWeight: '600'
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12
  },
  columnWrap: {
    gap: 12
  },
  card: {
    flex: 1,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    minHeight: 140
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 44,
    height: 44
  },
  emojiText: {
    fontSize: 22
  },
  cardMeta: {
    flex: 1,
    gap: 2
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1
  },
  defaultTag: {
    fontSize: 11,
    fontWeight: '600'
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  chipBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
