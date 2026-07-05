import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Trash2, Upload, ImagePlus, Sticker } from 'lucide-react'
import { Switch } from '../Switch/Switch'
import { Modal } from '../Modal/Modal'
import { HelpTooltip } from '../HelpTooltip'
import { toast } from '../Toast/useToast'
import type { EmojiToolConfig, ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

interface EmojiImportResult {
  relativePath: string
  originalName: string
  error: string | null
}

interface EmojiToolCardProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
}

const DEFAULT_EMOJI_CONFIG: EmojiToolConfig = {
  enabled: false,
  emojis: []
}

export const EmojiToolCard: React.FC<EmojiToolCardProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const emojiConfig = config.emojiConfig || DEFAULT_EMOJI_CONFIG
  const isEnabled = emojiConfig.enabled === true
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [emojiPreviews, setEmojiPreviews] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadEmojiPreviews = useCallback(async () => {
    const emojis = emojiConfig.emojis
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
      console.warn('[EmojiToolCard] Failed to load emoji previews:', e)
    }
  }, [emojiConfig.emojis])

  useEffect(() => {
    loadEmojiPreviews()
  }, [loadEmojiPreviews])

  // 当弹窗打开时也刷新预览
  useEffect(() => {
    if (showSettingsPopup) {
      loadEmojiPreviews()
    }
  }, [showSettingsPopup, loadEmojiPreviews])

  const handleToggle = () => {
    onChange({
      ...config,
      emojiConfig: { ...emojiConfig, enabled: !isEnabled }
    })
  }

  const handlePickAndImport = async () => {
    try {
      setIsLoading(true)
      const api = (window as any).api
      if (!api?.emoji?.pickAndImport) return

      const results: EmojiImportResult[] = await api.emoji.pickAndImport()
      if (!results || results.length === 0) return

      const newEmojis = []
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

      if (errors.length > 0) {
        const errorMsg =
          errors.length === 1
            ? errors[0]
            : t('agent.tools.emoji_import_partial_error', '{{count}} 个文件导入失败', {
                count: errors.length
              }) +
              '：' +
              errors.join('；')
        toast.showError(errorMsg)
      }

      if (newEmojis.length > 0) {
        toast.showSuccess(
          t('agent.tools.emoji_import_success', '成功导入 {{count}} 个表情包', {
            count: newEmojis.length
          })
        )
        onChange({
          ...config,
          emojiConfig: { ...emojiConfig, emojis: [...(emojiConfig.emojis || []), ...newEmojis] }
        })
      }
    } catch (e) {
      console.error('[EmojiToolCard] Failed to pick emoji:', e)
      toast.showError(t('agent.tools.emoji_import_error', '表情包导入失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEmoji = (emojiId: string) => {
    const emoji = emojiConfig.emojis?.find((e) => e.id === emojiId)
    if (!emoji) return
    onChange({
      ...config,
      emojiConfig: {
        ...emojiConfig,
        emojis: emojiConfig.emojis?.filter((e) => e.id !== emojiId) || []
      }
    })
    const api = (window as any).api
    if (api?.emoji?.delete) api.emoji.delete(emoji.relativePath).catch(() => {})
  }

  const handleRenameEmoji = (emojiId: string, newName: string) => {
    onChange({
      ...config,
      emojiConfig: {
        ...emojiConfig,
        emojis:
          emojiConfig.emojis?.map((e) => (e.id === emojiId ? { ...e, name: newName } : e)) || []
      }
    })
  }

  const noEmojis = (!emojiConfig.emojis || emojiConfig.emojis.length === 0);

  return (
    <div className={`${styles.toolCard} ${isEnabled ? styles.enabled : styles.disabled}`}>
      {/* 卡片主体 */}
      <div className={styles.cardMain}>
        <div className={styles.toolIconWrapper}>
          <Sticker size={20} />
        </div>
        <div className={styles.toolInfo}>
          <div className={styles.toolNameRow}>
            <span className={styles.toolName}>{t('agent.tools.emoji_send', '表情包')}</span>
            <span className={styles.toolIdTag}>emoji_send</span>
            <HelpTooltip
              content={t(
                'agent.tools.emoji_send_desc',
                '根据对话情绪自动回复表情包贴图，让对话更生动'
              )}
            />
          </div>
        </div>
        {/* 设置按钮 — 点击弹 Popup */}
        <button
          className={styles.emojiSettingsBtn}
          onClick={() => setShowSettingsPopup(true)}
          title={t('agent.tools.emoji_settings', '设置')}
        >
          <Settings size={12} />
        </button>
        <Switch checked={isEnabled} onChange={handleToggle} />
      </div>

      {/* 设置弹窗 */}
      <Modal
        isOpen={showSettingsPopup}
        onClose={() => setShowSettingsPopup(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sticker size={20} />
            <span>{t('agent.tools.emoji_settings_title', '表情包设置')}</span>
          </div>
        }
        closeOnOverlayClick
        className={styles.emojiPopupModal}
      >
        <div className={styles.emojiPopupContent}>
          {/* 表情包网格管理 */}
          <div className={styles.emojiManageSection}>
            <div className={styles.emojiManageLabel}>
              {t('agent.tools.emoji_manage_label', '表情包管理')}
            </div>
            <div className={styles.emojiPopupGrid} style={noEmojis ? {gridTemplateColumns: 'unset'} : {}}>
              {emojiConfig.emojis?.map((emoji) => (
                <div key={emoji.id} className={styles.emojiCard}>
                  <div className={styles.emojiCardImage}>
                    {emojiPreviews[emoji.id] ? (
                      <img
                        src={emojiPreviews[emoji.id]}
                        alt={emoji.name}
                        className={styles.emojiImg}
                      />
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
                      className={styles.emojiDeleteBtn}
                      onClick={() => handleDeleteEmoji(emoji.id)}
                      title={t('agent.tools.emoji_delete', '删除')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {noEmojis ? (
                <button
                  className={styles.emojiEmptyHint}
                  onClick={handlePickAndImport}
                  disabled={isLoading}
                >
                  <ImagePlus size={32} className={styles.emojiEmptyIcon} />
                  <p className={styles.emojiEmptyText}>
                    {isLoading
                      ? t('agent.tools.emoji_importing', '导入中...')
                      : t('agent.tools.emoji_empty_hint', '还没有表情包，点击添加')}
                  </p>
                </button>
              ) : (
                <button
                  className={styles.emojiAddCard}
                  onClick={handlePickAndImport}
                  disabled={isLoading}
                >
                  <Upload size={24} className={styles.emojiAddIcon} />
                  <span className={styles.emojiAddText}>
                    {isLoading
                      ? t('agent.tools.emoji_importing', '导入中...')
                      : t('agent.tools.emoji_add', '添加')}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className={styles.emojiPopupAuthor}>Developer:Ratman463</div>
        </div>
      </Modal>
    </div>
  )
}
