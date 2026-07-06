import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Sticker, Trash2 } from 'lucide-react'
import type { EmojiGroup, EmojiItem, EmojiToolConfig } from '@baishou/shared'
import { findEmojiGroup, normalizeEmojiToolConfig, upsertEmojiGroup } from '@baishou/shared'
import { toast } from '../Toast/useToast'
import styles from '../AgentToolsView/AgentToolsView.module.css'

export interface EmojiGroupDetailViewProps {
  config: EmojiToolConfig
  groupId: string
  onChange: (config: EmojiToolConfig) => void
}

export const EmojiGroupDetailView: React.FC<EmojiGroupDetailViewProps> = ({
  config,
  groupId,
  onChange
}) => {
  const { t } = useTranslation()
  const normalized = useMemo(() => normalizeEmojiToolConfig(config), [config])
  const group = findEmojiGroup(normalized, groupId)
  const [emojiPreviews, setEmojiPreviews] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadEmojiPreviews = useCallback(async () => {
    const emojis = group?.emojis
    if (!emojis || emojis.length === 0) {
      setEmojiPreviews({})
      return
    }
    try {
      const api = (window as any).api
      if (!api?.emoji?.resolvePaths) return
      const paths = emojis.map((e) => e.relativePath)
      const resolved = await api.emoji.resolvePaths(paths)
      const previews: Record<string, string> = {}
      emojis.forEach((emoji, i) => {
        if (resolved[i]) previews[emoji.id] = resolved[i]
      })
      setEmojiPreviews(previews)
    } catch (e) {
      console.warn('[EmojiGroupDetailView] Failed to load emoji previews:', e)
    }
  }, [group?.emojis])

  useEffect(() => {
    void loadEmojiPreviews()
  }, [loadEmojiPreviews])

  if (!group) {
    return (
      <div className={styles.emojiSettingsEmpty}>
        {t('agent.tools.emoji_group_not_found', '表情包组不存在')}
      </div>
    )
  }

  const updateGroup = (nextGroup: EmojiGroup) => {
    onChange(upsertEmojiGroup(normalized, nextGroup))
  }

  const handlePickAndImport = async () => {
    try {
      setIsLoading(true)
      const api = (window as any).api
      if (!api?.emoji?.pickAndImport) return

      const results: Array<{
        relativePath: string
        originalName: string
        error: string | null
      }> = await api.emoji.pickAndImport()
      if (!results || results.length === 0) return

      const newEmojis: EmojiItem[] = []
      const errors: string[] = []

      for (const result of results) {
        if (result.error) {
          errors.push(result.error)
        } else if (result.relativePath) {
          const name =
            result.originalName ||
            result.relativePath
              .split('/')
              .pop()
              ?.replace(/\.[^.]+$/, '') ||
            ''
          newEmojis.push({
            id: result.relativePath.split('/').pop() || result.relativePath,
            name: name.replace(/^emoji_/, ''),
            relativePath: result.relativePath
          })
        }
      }

      if (newEmojis.length > 0) {
        updateGroup({ ...group, emojis: [...(group.emojis || []), ...newEmojis] })
        void loadEmojiPreviews()
      }
      if (errors.length > 0) {
        toast.showError(errors.join('\n'))
      }
    } catch (e) {
      console.error('[EmojiGroupDetailView] Import failed:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEmoji = async (emojiId: string) => {
    const emoji = group.emojis?.find((e) => e.id === emojiId)
    if (!emoji) return
    try {
      const api = (window as any).api
      if (api?.emoji?.delete) {
        await api.emoji.delete(emoji.relativePath)
      }
    } catch {
      // ignore
    }
    updateGroup({
      ...group,
      emojis: group.emojis?.filter((e) => e.id !== emojiId) || []
    })
  }

  const handleRenameEmoji = (emojiId: string, newName: string) => {
    updateGroup({
      ...group,
      emojis: group.emojis?.map((e) => (e.id === emojiId ? { ...e, name: newName } : e)) || []
    })
  }

  return (
    <div className={styles.emojiSettingsPage}>
      <div className={`${styles.toolCard} ${styles.enabled}`}>
        <div className={styles.cardMain}>
          <div className={styles.toolIconWrapper}>
            <Sticker size={20} />
          </div>
          <div className={styles.toolInfo}>
            <div className={styles.toolNameRow}>
              <span className={styles.toolName}>{t('agent.tools.emoji_group_name', '组名称')}</span>
            </div>
          </div>
        </div>
        <div className={styles.paramsWrapper}>
          <div className={styles.paramsDivider} />
          <div className={styles.paramsConfigArea}>
            <input
              className={styles.emojiGroupNameInput}
              value={group.name}
              onChange={(e) => updateGroup({ ...group, name: e.target.value })}
              placeholder={t('agent.tools.emoji_group_name_placeholder', '例如：日常、工作')}
              maxLength={24}
            />
          </div>
        </div>
      </div>

      <div className={styles.categoryHeader}>
        <span className={styles.categoryIcon}>
          <ImagePlus size={18} />
        </span>
        <span className={styles.categoryLabel}>
          {t('agent.tools.emoji_stickers_title', '表情贴图')}
        </span>
        <button
          type="button"
          className={styles.emojiAddGroupBtn}
          onClick={() => void handlePickAndImport()}
          disabled={isLoading}
        >
          <ImagePlus size={16} />
          {t('agent.tools.emoji_upload', '上传表情')}
        </button>
      </div>

      {group.emojis && group.emojis.length > 0 ? (
        <div className={styles.emojiPopupGrid}>
          {group.emojis.map((emoji) => (
            <div key={emoji.id} className={styles.emojiCard}>
              <div className={styles.emojiCardImage}>
                {emojiPreviews[emoji.id] ? (
                  <img src={emojiPreviews[emoji.id]} alt={emoji.name} className={styles.emojiImg} />
                ) : (
                  <div className={styles.emojiPlaceholder}>
                    <ImagePlus size={24} />
                  </div>
                )}
              </div>
              <div className={styles.emojiCardFooter}>
                <input
                  className={styles.emojiCardNameInput}
                  value={emoji.name}
                  onChange={(e) => handleRenameEmoji(emoji.id, e.target.value)}
                  placeholder={t('agent.tools.emoji_name_placeholder', '名称')}
                />
                <button
                  type="button"
                  className={styles.emojiDeleteBtn}
                  onClick={() => void handleDeleteEmoji(emoji.id)}
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emojiStickerAreaEmpty}>
          {isLoading
            ? t('agent.tools.emoji_importing', '导入中...')
            : t('agent.tools.emoji_stickers_empty', '暂无表情贴图')}
        </div>
      )}
    </div>
  )
}
