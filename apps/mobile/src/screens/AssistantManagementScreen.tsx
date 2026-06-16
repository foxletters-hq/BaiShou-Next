import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity
} from 'react-native'
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams
} from 'react-native-draggable-flatlist'
import { MaterialIcons } from '@expo/vector-icons'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  Input,
  AssistantAvatar,
  AssistantKindBadge
} from '@baishou/ui/native'
import type { AssistantKind } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { listAssistantsForUi } from '../lib/mobile-assistant.util'

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
  assistantKind?: AssistantKind
  sortOrder?: number
}

export const AssistantManagementScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, vaultRevision } = useBaishou()
  const router = useRouter()

  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const assistantList = await listAssistantsForUi(
        services.assistantManager,
        services.attachmentManager,
        services.fileSystem,
        { preferFileUri: true }
      )
      setAssistants(assistantList)
    } catch (e) {
      console.error('Failed to load assistants', e)
    } finally {
      setLoading(false)
    }
  }, [dbReady, services, vaultRevision])

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
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    })
  }, [assistants, searchQuery])

  const isDragEnabled = searchQuery.trim() === ''

  const handleReorder = useCallback(
    async (ordered: Assistant[]) => {
      const next = ordered.map((item, index) => ({ ...item, sortOrder: index }))
      setAssistants(next)
      try {
        await services?.assistantManager.reorderAssistants(next.map((a) => a.id))
      } catch (e) {
        console.error('Failed to reorder assistants', e)
        void loadAssistants()
      }
    },
    [loadAssistants, services]
  )

  const handleCreateAssistant = () => {
    router.push('/settings/assistant-edit?id=new')
  }

  const handleEditAssistant = (assistant: Assistant) => {
    router.push(`/settings/assistant-edit?id=${encodeURIComponent(assistant.id)}`)
  }

  const handleDeleteAssistant = async (assistant: Assistant) => {
    const confirmed = await dialog.confirm(t('agent.assistant.delete_confirm_content'), {
        title: t('agent.assistant.delete_confirm_title'),
        confirmText: t('common.delete'),
        destructive: true
      })
    if (!confirmed) return
    try {
      await services?.assistantManager.delete(assistant.id)
      setAssistants((prev) => prev.filter((a) => a.id !== assistant.id))
      toast.showSuccess(t('agent.assistant.deleted'))
    } catch (e) {
      console.error('Failed to delete assistant', e)
      toast.showError(t('common.delete_failed', '删除失败'))
    }
  }

  const handleTogglePin = async (assistant: Assistant) => {
    try {
      await services?.assistantManager.togglePin(assistant.id, !assistant.isPinned)
      setAssistants((prev) =>
        prev.map((a) => (a.id === assistant.id ? { ...a, isPinned: !a.isPinned } : a))
      )
    } catch (e) {
      console.error('Failed to toggle pin', e)
    }
  }

  const renderCard = ({ item, drag, isActive }: RenderItemParams<Assistant>) => (
    <ScaleDecorator>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.bgSurface,
            borderColor: item.isPinned ? colors.primary : colors.borderSubtle,
            borderRadius: tokens.radius.lg,
            opacity: isActive ? 0.92 : 1
          },
          item.isPinned && { borderWidth: 1.5 }
        ]}
        onPress={() => handleEditAssistant(item)}
        activeOpacity={0.75}
      >
      <View style={styles.cardHeader}>
        {isDragEnabled ? (
          <TouchableOpacity
            onPressIn={drag}
            style={[styles.dragHandle, { borderColor: colors.borderSubtle }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="drag-indicator" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
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
            <AssistantKindBadge kind={item.assistantKind} compact />
            {item.isPinned ? (
              <MaterialIcons name="push-pin" size={14} color={colors.primary} />
            ) : null}
          </View>
          {item.isDefault ? (
            <Text style={[styles.defaultTag, { color: colors.primary }]}>
              {t('agent.assistant.default_tag')}
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
    </ScaleDecorator>
  )

  return (
    <StackScreenLayout
      title={t('agent.assistant.title', '伙伴管理')}
      {...getStackScreenChrome(colors)}
      headerRight={{
        icon: 'add',
        onPress: handleCreateAssistant,
        accessibilityLabel: t('agent.assistant.create_new', '新增伙伴')
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
      ) : isDragEnabled ? (
        <DraggableFlatList
          data={processedAssistants}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => void handleReorder(data)}
          style={{ flex: 1, backgroundColor: colors.bgApp }}
          contentContainerStyle={styles.listContent}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          ListHeaderComponent={
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('agent.assistant.search_hint', '搜索伙伴...')}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>{t('common.no_data')}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={processedAssistants}
          renderItem={({ item }) =>
            renderCard({ item, drag: () => {}, isActive: false, getIndex: () => null })
          }
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: colors.bgApp }}
          contentContainerStyle={styles.listContent}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          ListHeaderComponent={
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('agent.assistant.search_hint')}
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
    borderWidth: 1,
    padding: 14,
    gap: 10,
    minHeight: 140
  },
  dragHandle: {
    width: 28,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
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
