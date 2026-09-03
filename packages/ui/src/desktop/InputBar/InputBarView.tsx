import React, { useCallback, useMemo, useRef, useState } from 'react'
import styles from './InputBar.module.css'
import { motion } from 'framer-motion'
import type { useInputBar } from './useInputBar'
import { AnchoredContextMenu } from '../ContextMenu/AnchoredContextMenu'
import type { ContextMenuItem } from '../ContextMenu/ContextMenu'
import {
  getContextMenuBoundsForAnchor,
  type ContextMenuBounds
} from '../ContextMenu/context-menu-placement.util'
import { getInputBarTextareaMinHeight } from './useInputBarExpand'
import { InputBarSkillEditor } from './InputBarSkillEditor'
import { FileMentionPicker } from './FileMentionPicker'
import { SkillSlashPicker } from './SkillSlashPicker'
import { formatFileMentionLabel } from '@baishou/shared'
import {
  BookOpen,
  Check,
  FolderOpen,
  Globe,
  LayoutGrid,
  Paperclip,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  X
} from 'lucide-react'
import { getFileTypeIcon } from '../shared/FileTypeIcon'
import { getShortcutCommand } from '@baishou/shared'
import { resolveInputBarPrimaryAction } from '../../shared/input-bar-primary-action.util'
import { shouldAcceptAttachmentDrag } from './input-bar-drop.util'

type InputBarViewModel = ReturnType<typeof useInputBar>

type MenuAnchorState = {
  x: number
  y: number
  bounds: ContextMenuBounds
}

function buildSkillMenuItems(options: {
  t: InputBarViewModel['t']
  localizedShortcuts: InputBarViewModel['localizedShortcuts']
  handlePromptShortcut: () => void
  armCreateSkillChip: () => void
  applyShortcut: InputBarViewModel['applyShortcut']
}): ContextMenuItem[] {
  const { t, localizedShortcuts, handlePromptShortcut, armCreateSkillChip, applyShortcut } = options

  const items: ContextMenuItem[] = [
    {
      icon: <Settings2 size={15} />,
      label: t('shortcut.manager_title', 'Skill 管理'),
      onClick: handlePromptShortcut
    },
    { label: '', onClick: () => undefined, divider: true },
    {
      icon: <Plus size={15} />,
      label: t('shortcut.create_skill', '创建 Skill'),
      onClick: armCreateSkillChip
    },
    { label: '', onClick: () => undefined, divider: true }
  ]

  if (localizedShortcuts.length > 0) {
    items.push({
      label: t('shortcut.existing_skills', '现存 Skill'),
      disabled: true,
      onClick: () => undefined
    })
    for (const skill of localizedShortcuts) {
      const command = getShortcutCommand(skill)
      const displayName = skill.name?.trim()
      items.push({
        icon:
          skill.source === 'workspace' ? <FolderOpen size={15} /> : <Sparkles size={15} />,
        label: displayName ? `${displayName}` : `/${command}`,
        onClick: () => applyShortcut(skill)
      })
    }
  } else {
    items.push({
      label: t('shortcut.no_skills_yet', '暂无 Skill'),
      disabled: true,
      onClick: () => undefined
    })
  }

  return items
}

export function InputBarView({ vm }: { vm: InputBarViewModel }) {
  const {
    t,
    text,
    attachments,
    setAttachments,
    editorRef,
    composerSyncKey,
    composerSyncHtml,
    handleComposerSnapshot,
    handleSend,
    handleKeyDown,
    fileInputRef,
    handlePickFiles,
    handleNativeWebFileChange,
    handleAttachmentDrop,
    attachmentIntake,
    handlePaste,
    onOpenFileRef,
    skillPickerOpen,
    closeSkillPicker,
    slashPickerEntries,
    skillPickerIndex,
    setSkillPickerIndex,
    mentionPickerOpen,
    closeMentionPicker,
    mentionPickerEntries,
    mentionPickerIndex,
    setMentionPickerIndex,
    applyFileMention,
    fileRefs,
    applyShortcut,
    armCreateSkillChip,
    skillRefs,
    toggleSearchMode,
    handlePromptShortcut,
    localizedShortcuts,
    isLoading,
    allowSendWhileLoading = false,
    isSending,
    onStop,
    onRecall,
    onOpenTools,
    searchMode,
    ttsMode,
    onToggleTtsMode,
    onOpenNotebookMount,
    bottomTrailing,
    footer,
    sendIconSize = 15,
    minRows = 1,
    isMultiline = false
  } = vm

  const textareaMinHeight = getInputBarTextareaMinHeight(minRows)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [dropActive, setDropActive] = useState(false)

  const clearDropActive = useCallback(() => setDropActive(false), [])

  const handleDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (!shouldAcceptAttachmentDrag(e.dataTransfer, attachmentIntake)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setDropActive(true)
    },
    [attachmentIntake]
  )

  const handleDragLeaveCapture = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setDropActive(false)
  }, [])

  const handleDropCapture = useCallback(
    (e: React.DragEvent) => {
      if (!shouldAcceptAttachmentDrag(e.dataTransfer, attachmentIntake)) return
      e.preventDefault()
      e.stopPropagation()
      clearDropActive()
      void handleAttachmentDrop(e.dataTransfer)
    },
    [attachmentIntake, clearDropActive, handleAttachmentDrop]
  )

  const [plusMenu, setPlusMenu] = useState<MenuAnchorState | null>(null)
  const plusMenuOpen = plusMenu != null

  const closePlusMenu = useCallback(() => setPlusMenu(null), [])

  const openPlusMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const anchor = e.currentTarget
    const rect = anchor.getBoundingClientRect()
    const bounds = getContextMenuBoundsForAnchor(anchor)
    setPlusMenu((prev) =>
      prev
        ? null
        : {
            x: rect.left + 10,
            y: rect.top - 14,
            bounds
          }
    )
    requestAnimationFrame(() => anchor.blur())
  }, [])

  const skillSubmenuItems = useMemo(
    () =>
      buildSkillMenuItems({
        t,
        localizedShortcuts,
        handlePromptShortcut,
        armCreateSkillChip,
        applyShortcut
      }),
    [t, localizedShortcuts, handlePromptShortcut, armCreateSkillChip, applyShortcut]
  )

  const slashPickerItems = useMemo(
    () =>
      slashPickerEntries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        iconKind:
          entry.kind === 'create'
            ? ('create' as const)
            : entry.skill?.source === 'workspace'
              ? ('workspace' as const)
              : ('software' as const),
        onSelect: () => {
          if (entry.kind === 'create') armCreateSkillChip()
          else if (entry.skill) applyShortcut(entry.skill)
        }
      })),
    [slashPickerEntries, armCreateSkillChip, applyShortcut]
  )

  const plusMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        icon: <Paperclip size={15} />,
        label: t('input.upload_attachment', '上传附件'),
        onClick: handlePickFiles
      },
      {
        icon: <Sparkles size={15} />,
        label: t('input.shortcut_command', 'Skill'),
        children: skillSubmenuItems
      }
    ]

    if (onOpenNotebookMount) {
      items.push({
        icon: <BookOpen size={15} />,
        label: t('workbench.notebook_mount', '知识库笔记本'),
        onClick: onOpenNotebookMount
      })
    }

    if (onRecall) {
      items.push({
        icon: <BookOpen size={15} />,
        label: t('settings.recall_memories'),
        onClick: onRecall
      })
    }

    items.push({ label: '', onClick: () => undefined, divider: true })

    items.push({
      icon: searchMode ? <Check size={15} /> : <Globe size={15} />,
      label: searchMode ? t('settings.web_search_mode_tool') : t('settings.web_search_mode_off'),
      onClick: toggleSearchMode,
      keepOpen: true
    })

    if (onToggleTtsMode) {
      items.push({
        icon: ttsMode === 'always' ? <Check size={15} /> : <Volume2 size={15} />,
        label:
          ttsMode === 'always'
            ? t('agent.chat.tts_always', '始终朗读')
            : t('agent.chat.tts_manual', '手动朗读'),
        onClick: onToggleTtsMode,
        keepOpen: true
      })
    }

    if (onOpenTools) {
      items.push({
        icon: <LayoutGrid size={15} />,
        label: t('settings.agent_tools_title', '工具管理'),
        onClick: onOpenTools
      })
    }

    return items
  }, [
    t,
    handlePickFiles,
    skillSubmenuItems,
    onOpenNotebookMount,
    onRecall,
    searchMode,
    toggleSearchMode,
    ttsMode,
    onToggleTtsMode,
    onOpenTools
  ])

  const placeholder =
    skillRefs.length > 0
      ? t('shortcut.skill_ref_placeholder', '补充说明（可选）…')
      : (vm.placeholder ??
        t('agent.chat.input_hint', 'Type a message… Shift+Enter for new line'))

  const mentionPickerItems = useMemo(
    () =>
      mentionPickerEntries.map((entry) => ({
        id: entry.id,
        path: entry.path,
        group: entry.group,
        onSelect: () => applyFileMention(entry.path)
      })),
    [applyFileMention, mentionPickerEntries]
  )

  const canSend = Boolean(
    text.trim() || attachments.length > 0 || skillRefs.length > 0 || fileRefs.length > 0
  )
  const primaryAction = resolveInputBarPrimaryAction({
    isLoading,
    canSend,
    allowSendWhileLoading,
    hasStopHandler: Boolean(onStop)
  })
  const sendDisabled =
    isSending || !canSend || (isLoading && !allowSendWhileLoading)

  return (
    <div
      className={styles.containerMask}
      data-desktop-input-bar
      onDragOverCapture={handleDragOverCapture}
      onDragLeaveCapture={handleDragLeaveCapture}
      onDropCapture={handleDropCapture}
      style={
        {
          ['--input-bar-textarea-min-height' as string]: `${textareaMinHeight}px`
        } as React.CSSProperties
      }
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleNativeWebFileChange}
        style={{ display: 'none' }}
      />
      <div className={styles.constrainedBox}>
        {skillPickerOpen && slashPickerItems.length > 0 ? (
          <SkillSlashPicker
            items={slashPickerItems}
            selectedIndex={skillPickerIndex}
            onSelectIndex={setSkillPickerIndex}
            onClose={closeSkillPicker}
          />
        ) : null}
        {mentionPickerOpen ? (
          <FileMentionPicker
            items={mentionPickerItems}
            selectedIndex={mentionPickerIndex}
            onSelectIndex={setMentionPickerIndex}
            onClose={closeMentionPicker}
            emptyHint={t('workbench.file_mention_empty', '输入文件名以搜索工作区')}
          />
        ) : null}

        {attachments.length > 0 && (
          <div className={styles.attachmentList}>
            {attachments.map((att) => (
              <div key={att.id} className={styles.attachmentChip}>
                {att.isImage ? (
                  <img
                    src={
                      att.filePath?.startsWith('blob:') ||
                      att.filePath?.startsWith('local://') ||
                      att.filePath?.startsWith('data:')
                        ? att.filePath
                        : `local:///${(att.filePath || '').replace(/\\/g, '/')}`
                    }
                    className={styles.attPreviewImg}
                    alt={att.fileName}
                  />
                ) : (
                  <div className={styles.attFileBox}>
                    <span className={styles.attFileIcon}>{getFileTypeIcon(att.fileName, 18)}</span>
                    <div className={styles.attFileMeta}>
                      <span className={styles.attFileName}>
                        {att.relativePath
                          ? formatFileMentionLabel({
                              relativePath: att.relativePath,
                              selection: att.selection
                            }).replace(/^@/, '')
                          : att.fileName}
                      </span>
                      <span className={styles.attFileSize}>
                        {att.comment?.trim()
                          ? att.comment
                          : att.fileSize
                            ? att.fileSize < 1024 * 1024
                              ? `${(att.fileSize / 1024).toFixed(1)} KB`
                              : `${(att.fileSize / 1024 / 1024).toFixed(1)} MB`
                            : att.relativePath || ''}
                      </span>
                    </div>
                  </div>
                )}
                <button
                  className={styles.attRemoveBtn}
                  onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== att.id))}
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`${styles.composerShell}${footer ? ` ${styles.composerShellWithFooter}` : ''}${dropActive ? ` ${styles.composerShellDropActive}` : ''}`}
        >
          <div className={styles.inputCard}>
            <div
              className={`${styles.composerRow}${isMultiline ? ` ${styles.composerRowStacked}` : ''}`}
            >
              <button
                className={`${styles.appMenuBtn} ${plusMenuOpen ? styles.appMenuBtnActive : ''}`}
                onClick={openPlusMenu}
                type="button"
                aria-haspopup="menu"
                aria-expanded={plusMenuOpen}
                title={t('input.open_actions', '更多操作')}
              >
                <Plus size={16} strokeWidth={2} />
              </button>

              <div className={styles.inputWrapper} ref={inputWrapperRef}>
                <InputBarSkillEditor
                  editorRef={editorRef}
                  syncKey={composerSyncKey}
                  syncHtml={composerSyncHtml}
                  syncPlainText={text}
                  placeholder={placeholder}
                  minRows={minRows}
                  onSnapshot={handleComposerSnapshot}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onOpenFileRef={onOpenFileRef}
                />
              </div>

              <div className={styles.bottomRight}>
                {bottomTrailing ? (
                  <div className={styles.bottomTrailing}>{bottomTrailing}</div>
                ) : null}
                <div className={styles.sendBtnWrapper}>
                  {primaryAction === 'stop' ? (
                    <motion.button
                      className={`${styles.actionBtn} ${styles.stopBtn}`}
                      onClick={onStop}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      aria-label={t('common.stop', '停止')}
                      title={t('common.stop', '停止')}
                    >
                      <span className={styles.stopSquare} aria-hidden />
                    </motion.button>
                  ) : (
                    <motion.button
                      className={`${styles.actionBtn} ${styles.sendBtn} ${sendDisabled ? styles.sendBtnDisabled : ''}`}
                      onClick={handleSend}
                      disabled={sendDisabled}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      aria-label={t('common.send', '发送')}
                      title={t('common.send', '发送')}
                    >
                      <Send size={sendIconSize} />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </div>

      {plusMenu && (
        <AnchoredContextMenu
          x={plusMenu.x}
          y={plusMenu.y}
          items={plusMenuItems}
          onClose={closePlusMenu}
          bounds={plusMenu.bounds}
          preferAbove
        />
      )}
    </div>
  )
}
