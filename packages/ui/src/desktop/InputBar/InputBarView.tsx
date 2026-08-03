import React, { useCallback, useMemo, useState } from 'react'
import styles from './InputBar.module.css'
import { motion } from 'framer-motion'
import type { useInputBar } from './useInputBar'
import { PromptShortcutSheet } from '../PromptShortcutSheet'
import { AnchoredContextMenu } from '../ContextMenu/AnchoredContextMenu'
import type { ContextMenuItem } from '../ContextMenu/ContextMenu'
import {
  getContextMenuBoundsForAnchor,
  type ContextMenuBounds
} from '../ContextMenu/context-menu-placement.util'
import { getInputBarTextareaMinHeight } from './useInputBarExpand'
import {
  BookOpen,
  Check,
  FileText,
  Folder,
  Globe,
  LayoutGrid,
  Paperclip,
  Plus,
  Send,
  Square,
  Volume2,
  X,
  Zap
} from 'lucide-react'

type InputBarViewModel = ReturnType<typeof useInputBar>

type PlusMenuState = {
  x: number
  y: number
  bounds: ContextMenuBounds
}

export function InputBarView({ vm }: { vm: InputBarViewModel }) {
  const {
    t,
    text,
    attachments,
    setAttachments,
    textareaRef,
    handleSend,
    handleKeyDown,
    fileInputRef,
    handlePickFiles,
    handleNativeWebFileChange,
    handlePaste,
    handleTextChange,
    shortcutModeActive,
    filteredShortcuts,
    shortcutSelectedIndex,
    applyShortcut,
    toggleSearchMode,
    handlePromptShortcut,
    isLoading,
    isSending,
    onStop,
    onRecall,
    onOpenTools,
    searchMode,
    ttsMode,
    onToggleTtsMode,
    bottomTrailing,
    footer,
    sendIconSize = 15,
    minRows = 1
  } = vm

  const textareaMinHeight = getInputBarTextareaMinHeight(minRows)

  const [plusMenu, setPlusMenu] = useState<PlusMenuState | null>(null)
  const plusMenuOpen = plusMenu != null

  const closePlusMenu = useCallback(() => setPlusMenu(null), [])

  const openPlusMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    // currentTarget 在事件回调返回后会被清空，必须在 setState updater 外同步读取
    const anchor = e.currentTarget
    const rect = anchor.getBoundingClientRect()
    const bounds = getContextMenuBoundsForAnchor(anchor)
    setPlusMenu((prev) =>
      prev
        ? null
        : {
            // 相对加号略向右；y 预留间距，向上翻转时菜单底边不贴按钮
            x: rect.left + 10,
            y: rect.top - 8,
            bounds
          }
    )
  }, [])

  const plusMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        icon: <Paperclip size={15} />,
        label: t('input.upload_attachment', '上传附件'),
        onClick: handlePickFiles
      },
      {
        icon: <Zap size={15} />,
        label: t('input.shortcut_command', '快捷指令'),
        onClick: handlePromptShortcut
      }
    ]

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
      label: searchMode
        ? t('settings.web_search_mode_tool')
        : t('settings.web_search_mode_off'),
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
    handlePromptShortcut,
    onRecall,
    searchMode,
    toggleSearchMode,
    ttsMode,
    onToggleTtsMode,
    onOpenTools
  ])

  return (
    <div
      className={styles.containerMask}
      data-desktop-input-bar
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
        <PromptShortcutSheet
          isOpen={shortcutModeActive}
          shortcuts={filteredShortcuts}
          selectedIndex={shortcutSelectedIndex}
          compact
          onSelect={applyShortcut}
        />
        {/* Attachments Preview */}
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
                    <span className={styles.attFileIcon}>
                      {att.isPdf || att.isText ? <FileText size={18} /> : <Folder size={18} />}
                    </span>
                    <div className={styles.attFileMeta}>
                      <span className={styles.attFileName}>{att.fileName}</span>
                      <span className={styles.attFileSize}>
                        {att.fileSize
                          ? att.fileSize < 1024 * 1024
                            ? `${(att.fileSize / 1024).toFixed(1)} KB`
                            : `${(att.fileSize / 1024 / 1024).toFixed(1)} MB`
                          : '124 KB'}
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
          className={`${styles.composerShell}${footer ? ` ${styles.composerShellWithFooter}` : ''}`}
        >
          <div className={styles.inputCard}>
            <div className={styles.topRow}>
              <div className={styles.inputWrapper}>
                <textarea
                  ref={textareaRef}
                  rows={minRows}
                  className={styles.textarea}
                  placeholder={
                    vm.placeholder ??
                    t('agent.chat.input_hint', 'Type a message… Shift+Enter for new line')
                  }
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={1}
                />
              </div>
            </div>

            <div className={styles.bottomRow}>
              <button
                className={`${styles.appMenuBtn} ${plusMenuOpen ? styles.appMenuBtnActive : ''}`}
                onClick={openPlusMenu}
                type="button"
                aria-haspopup="menu"
                aria-expanded={plusMenuOpen}
                title={t('input.open_actions', '更多操作')}
              >
                <Plus size={22} strokeWidth={1.75} />
              </button>

              <div className={styles.bottomRight}>
                {bottomTrailing ? (
                  <div className={styles.bottomTrailing}>{bottomTrailing}</div>
                ) : null}
                <div className={styles.sendBtnWrapper}>
                  {isLoading ? (
                    <motion.button
                      className={`${styles.actionBtn} ${styles.stopBtn}`}
                      onClick={onStop}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                    >
                      <Square size={14} />
                    </motion.button>
                  ) : (
                    <motion.button
                      className={`${styles.actionBtn} ${styles.sendBtn} ${!text.trim() && attachments.length === 0 ? styles.sendBtnDisabled : ''}`}
                      onClick={handleSend}
                      disabled={isSending || (!text.trim() && attachments.length === 0)}
                      type="button"
                      whileTap={{ scale: 0.92 }}
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
        />
      )}
    </div>
  )
}
