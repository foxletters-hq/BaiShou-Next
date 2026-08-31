import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { Plus, Search, X } from 'lucide-react-native'
import type { EmojiToolConfig } from '@baishou/shared'
import {
  createEmojiGroup,
  emojiGroupMatchesQuery,
  isEmojiGroupNameTaken,
  normalizeEmojiToolConfig,
  removeEmojiGroup,
  upsertEmojiGroup
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Checkbox } from '../Checkbox'
import { useDialog } from '../Dialog'
import { useNativeToast } from '../Toast/toast-context'
import { FloatingModal } from '../FloatingModal'
import { Input } from '../Input'
import { Pagination } from '../Pagination'
import { EmojiGroupDetailView } from '../EmojiSettingsView/EmojiGroupDetailView'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

const PAGE_SIZE = 5

export interface AssistantEmojiGroupPickerModalProps {
  visible: boolean
  onClose: () => void
  emojiConfig: EmojiToolConfig
  selectedGroupIds: string[]
  onToggleGroup: (groupId: string) => void
  onEmojiConfigChange: (config: EmojiToolConfig) => void
  onPickAndImport: () => Promise<
    {
      relativePath: string
      originalName: string
      error: string | null
    }[]
  >
  onResolvePath: (relativePath: string) => Promise<string>
  onDelete: (relativePath: string) => Promise<boolean>
}

export const AssistantEmojiGroupPickerModal: React.FC<AssistantEmojiGroupPickerModalProps> = ({
  visible,
  onClose,
  emojiConfig,
  selectedGroupIds,
  onToggleGroup,
  onEmojiConfigChange,
  onPickAndImport,
  onResolvePath,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()
  const normalized = normalizeEmojiToolConfig(emojiConfig)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null)
  const [coverPreviews, setCoverPreviews] = useState<Record<string, string>>({})

  const filtered = useMemo(
    () => normalized.groups.filter((group) => emojiGroupMatchesQuery(group, query)),
    [normalized.groups, query]
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const managingGroup = managingGroupId
    ? normalized.groups.find((group) => group.id === managingGroupId)
    : undefined
  const pageCoverKey = pageItems
    .map(
      (group) =>
        `${group.id}:${group.emojis?.[0]?.id ?? ''}:${group.emojis?.[0]?.relativePath ?? ''}`
    )
    .join('|')

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setPage(1)
      setManagingGroupId(null)
    }
  }, [visible])

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    let cancelled = false
    const covers = pageItems
      .map((group) => ({
        groupId: group.id,
        path: group.emojis?.[0]?.relativePath?.trim() || ''
      }))
      .filter((item) => item.path)

    if (covers.length === 0) {
      setCoverPreviews({})
      return
    }

    const load = async () => {
      const next: Record<string, string> = {}
      for (const item of covers) {
        try {
          const uri = await onResolvePath(item.path)
          if (uri) next[item.groupId] = uri
        } catch {
          // skip missing
        }
      }
      if (!cancelled) setCoverPreviews(next)
    }

    void load()
    return () => {
      cancelled = true
    }
    // pageCoverKey 已覆盖当前页封面变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCoverKey, onResolvePath])

  const handleAddGroup = async () => {
    const defaultName = t('agent.tools.emoji_group_default_name', '新表情包组')
    const inputName = await dialog.prompt(
      t('agent.tools.emoji_group_name_prompt', '请输入表情包组名称'),
      defaultName,
      t('agent.tools.emoji_group_add', '新建组')
    )
    if (inputName == null) return
    const trimmed = inputName.trim()
    if (!trimmed) return
    if (isEmojiGroupNameTaken(normalized, trimmed)) {
      toast.showError(
        t('agent.tools.emoji_group_name_conflict', '已存在名为「{{name}}」的组', {
          name: trimmed
        })
      )
      return
    }
    const group = createEmojiGroup(trimmed)
    onEmojiConfigChange(upsertEmojiGroup(normalized, group))
    setQuery('')
    setPage(1)
    setManagingGroupId(group.id)
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = await dialog.confirm(
      t(
        'agent.tools.emoji_group_delete_confirm',
        '确定删除表情包组「{{name}}」吗？此操作不可撤销。',
        { name: groupName }
      ),
      {
        title: t('agent.tools.emoji_group_delete_title', '删除表情包组'),
        confirmText: t('common.delete', '删除'),
        destructive: true
      }
    )
    if (!confirmed) return
    onEmojiConfigChange(removeEmojiGroup(normalized, groupId))
    if (managingGroupId === groupId) setManagingGroupId(null)
  }

  return (
    <>
      <FloatingModal visible={visible} onClose={onClose} maxWidth={440}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('common.close', '关闭')}>
            <X size={20} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </TouchableOpacity>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('agent.tools.emoji_group_search_placeholder', '搜索表情包组')}
              leftSlot={
                <Search size={16} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              }
            />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => void handleAddGroup()}>
            <Plus size={16} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>
              {t('agent.tools.emoji_group_add', '新建组')}
            </Text>
          </TouchableOpacity>
        </View>

        {pageItems.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {normalized.groups.length === 0
              ? t('agent.tools.emoji_groups_empty', '暂无表情包组，点击「新建组」开始添加')
              : t('agent.tools.emoji_groups_search_empty', '没有匹配的表情包组')}
          </Text>
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {pageItems.map((group) => {
              const selected = selectedGroupIds.includes(group.id)
              return (
                <View key={group.id} style={styles.row}>
                  <Checkbox
                    selected={selected}
                    onPress={() => onToggleGroup(group.id)}
                    accessibilityLabel={group.name}
                  />
                  <View
                    style={[styles.tile, { backgroundColor: colors.primaryContainer }]}
                  >
                    {coverPreviews[group.id] ? (
                      <Image source={{ uri: coverPreviews[group.id] }} style={styles.tileImg} />
                    ) : (
                      <Text style={[styles.tileText, { color: colors.primary }]}>
                        {group.name.trim().slice(0, 1) || '组'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => setManagingGroupId(group.id)}
                  >
                    <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                      {group.name}
                    </Text>
                    <Text style={[styles.groupMeta, { color: colors.textSecondary }]}>
                      {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                        count: group.emojis?.length ?? 0
                      })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setManagingGroupId(group.id)}>
                    <Text style={[styles.manage, { color: colors.primary }]}>
                      {t('agent.tools.emoji_group_manage', '管理')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </ScrollView>
        )}

        {filtered.length > PAGE_SIZE ? (
          <View style={styles.pager}>
            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={setPage}
              showFirstLast={false}
              showJumper={false}
            />
          </View>
        ) : null}
      </FloatingModal>

      <FloatingModal
        visible={Boolean(managingGroup)}
        onClose={() => setManagingGroupId(null)}
        maxWidth={440}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
            {managingGroup?.name || t('agent.tools.emoji_group_detail', '表情包组')}
          </Text>
          {managingGroup ? (
            <TouchableOpacity
              onPress={() => void handleDeleteGroup(managingGroup.id, managingGroup.name)}
            >
              <Text style={[styles.delete, { color: colors.error }]}>
                {t('common.delete', '删除')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setManagingGroupId(null)}
            accessibilityLabel={t('common.close', '关闭')}
          >
            <X size={20} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={{ paddingBottom: tokens.spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {managingGroupId ? (
            <EmojiGroupDetailView
              config={normalized}
              groupId={managingGroupId}
              onChange={onEmojiConfigChange}
              onPickAndImport={onPickAndImport}
              onResolvePath={onResolvePath}
              onDelete={onDelete}
            />
          ) : null}
        </ScrollView>
      </FloatingModal>
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600'
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8
  },
  searchWrap: {
    flex: 1
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600'
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    fontSize: 13,
    lineHeight: 20
  },
  list: {
    maxHeight: 320,
    paddingHorizontal: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10
  },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tileImg: {
    width: '100%',
    height: '100%'
  },
  tileText: {
    fontSize: 13,
    fontWeight: '600'
  },
  rowMain: {
    flex: 1,
    minWidth: 0
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600'
  },
  groupMeta: {
    fontSize: 13,
    marginTop: 2
  },
  manage: {
    fontSize: 13,
    fontWeight: '600'
  },
  pager: {
    paddingVertical: 8
  },
  delete: {
    fontSize: 14,
    fontWeight: '600'
  },
  detailScroll: {
    maxHeight: 420,
    paddingHorizontal: 16
  }
})
