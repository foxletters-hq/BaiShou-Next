import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus, Search } from 'lucide-react'
import type { EmojiToolConfig } from '@baishou/shared'
import {
  createEmojiGroup,
  emojiGroupMatchesQuery,
  isEmojiGroupNameTaken,
  normalizeEmojiToolConfig,
  removeEmojiGroup,
  upsertEmojiGroup
} from '@baishou/shared'
import { Input } from '../Input/Input'
import { useDialog } from '../Dialog'
import { toast } from '../Toast/useToast'
import { Modal } from '../Modal/Modal'
import { Pagination } from '../Pagination'
import { EmojiGroupDetailView } from '../EmojiSettingsView/EmojiGroupDetailView'
import emojiStyles from '../AgentToolsView/AgentToolsView.module.css'
import styles from './AssistantEditPage.module.css'

const PAGE_SIZE = 5

export interface AssistantEmojiGroupPickerDialogProps {
  isOpen: boolean
  onClose: () => void
  emojiConfig: EmojiToolConfig
  selectedGroupIds: string[]
  onToggleGroup: (groupId: string) => void
  onEmojiConfigChange: (config: EmojiToolConfig) => void
}

export const AssistantEmojiGroupPickerDialog: React.FC<AssistantEmojiGroupPickerDialogProps> = ({
  isOpen,
  onClose,
  emojiConfig,
  selectedGroupIds,
  onToggleGroup,
  onEmojiConfigChange
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
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
  const pageCovers = useMemo(
    () =>
      pageItems.map((group) => ({
        groupId: group.id,
        path: group.emojis?.[0]?.relativePath?.trim() || ''
      })),
    // pageItems 每轮都是新数组，用封面签名做依赖即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pageItems
        .map(
          (group) =>
            `${group.id}:${group.emojis?.[0]?.id ?? ''}:${group.emojis?.[0]?.relativePath ?? ''}`
        )
        .join('|')
    ]
  )

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setPage(1)
      setManagingGroupId(null)
    }
  }, [isOpen])

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    let cancelled = false
    const covers = pageCovers.filter((item) => item.path)

    if (covers.length === 0) {
      setCoverPreviews({})
      return
    }

    const load = async () => {
      try {
        const api = (
          window as { api?: { emoji?: { resolvePaths?: (paths: string[]) => Promise<string[]> } } }
        ).api
        if (!api?.emoji?.resolvePaths) return
        const resolved = await api.emoji.resolvePaths(covers.map((item) => item.path))
        if (cancelled) return
        const next: Record<string, string> = {}
        covers.forEach((item, index) => {
          const url = resolved[index]
          if (url) next[item.groupId] = url
        })
        setCoverPreviews(next)
      } catch {
        if (!cancelled) setCoverPreviews({})
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pageCovers])

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
      t('agent.tools.emoji_group_delete_title', '删除表情包组')
    )
    if (!confirmed) return
    onEmojiConfigChange(removeEmojiGroup(normalized, groupId))
    if (managingGroupId === groupId) setManagingGroupId(null)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlayClick
        zIndex={1600}
        className={emojiStyles.emojiPopupModal}
        title={t('agent.assistant.emoji_groups_pick_label', '可用的表情包组')}
      >
        <div className={styles.emojiPickerDialogBody}>
          <div className={emojiStyles.emojiInlineToolbar}>
            <label className={emojiStyles.emojiSearchField}>
              <Search size={14} aria-hidden />
              <Input
                type="search"
                fieldSize="small"
                className={emojiStyles.emojiSearchInputHost}
                inputClassName="baishou-form-field--embed"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('agent.tools.emoji_group_search_placeholder', '搜索表情包组')}
              />
            </label>
            <button
              type="button"
              className={emojiStyles.emojiInlineAddBtn}
              onClick={() => void handleAddGroup()}
            >
              <Plus size={14} strokeWidth={2} />
              {t('agent.tools.emoji_group_add', '新建组')}
            </button>
          </div>

          {pageItems.length === 0 ? (
            <div className={emojiStyles.emojiInlineEmpty}>
              {normalized.groups.length === 0
                ? t('agent.tools.emoji_groups_empty', '暂无表情包组，点击「新建组」开始添加')
                : t('agent.tools.emoji_groups_search_empty', '没有匹配的表情包组')}
            </div>
          ) : (
            <div className={emojiStyles.emojiInlineList}>
              {pageItems.map((group) => {
                const selected = selectedGroupIds.includes(group.id)
                return (
                  <div key={group.id} className={styles.emojiPickerRow}>
                    <button
                      type="button"
                      className={`${styles.emojiPickerCheck} ${
                        selected ? styles.emojiPickerCheckActive : ''
                      }`}
                      aria-pressed={selected}
                      aria-label={t('agent.assistant.emoji_group_assign', '让该伙伴使用此组')}
                      onClick={() => onToggleGroup(group.id)}
                    >
                      {selected ? <Check size={14} strokeWidth={2.5} /> : null}
                    </button>
                    <div className={emojiStyles.emojiGroupTile} aria-hidden>
                      {coverPreviews[group.id] ? (
                        <img
                          src={coverPreviews[group.id]}
                          alt=""
                          className={emojiStyles.emojiGroupTileImg}
                        />
                      ) : (
                        group.name.trim().slice(0, 1) || '组'
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.emojiPickerRowMain}
                      onClick={() => setManagingGroupId(group.id)}
                    >
                      <span className={emojiStyles.toolName}>{group.name}</span>
                      <span className={emojiStyles.toolMeta}>
                        {t('agent.tools.emoji_group_count', '{{count}} 个表情', {
                          count: group.emojis?.length ?? 0
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={emojiStyles.emojiManageBtn}
                      onClick={() => setManagingGroupId(group.id)}
                    >
                      {t('agent.tools.emoji_group_manage', '管理')}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className={emojiStyles.emojiInlinePager}>
              <Pagination
                current={currentPage}
                total={totalPages}
                onChange={setPage}
                showFirstLast={false}
                showJumper={false}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(managingGroup)}
        onClose={() => setManagingGroupId(null)}
        closeOnOverlayClick
        zIndex={1700}
        className={emojiStyles.emojiPopupModal}
        title={
          <div className={emojiStyles.emojiManageModalTitle}>
            <span>{managingGroup?.name || t('agent.tools.emoji_group_detail', '表情包组')}</span>
            {managingGroup ? (
              <button
                type="button"
                className={emojiStyles.emojiManageDeleteBtn}
                onClick={() => void handleDeleteGroup(managingGroup.id, managingGroup.name)}
              >
                {t('common.delete', '删除')}
              </button>
            ) : null}
          </div>
        }
      >
        {managingGroupId ? (
          <EmojiGroupDetailView
            config={normalized}
            groupId={managingGroupId}
            layout="dialog"
            onChange={onEmojiConfigChange}
          />
        ) : null}
      </Modal>
    </>
  )
}
