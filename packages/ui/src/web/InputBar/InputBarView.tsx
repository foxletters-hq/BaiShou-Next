import React from 'react'
import styles from './InputBar.module.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Paperclip,
  Zap,
  Globe,
  BookOpen,
  FileText,
  Folder,
  X,
  ArrowUp,
  LayoutGrid,
  Menu,
  Square,
  Volume2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { MdSend, MdStop, MdApps } from 'react-icons/md'
import type { useInputBar } from './useInputBar'
import { QuickActionChip } from './QuickActionChip'

type InputBarViewModel = ReturnType<typeof useInputBar>

export function InputBarView({ vm }: { vm: InputBarViewModel }) {
  const {
    t,
    text,
    attachments,
    setAttachments,
    showToolbar,
    setShowToolbar,
    textareaRef,
    toolbarViewportRef,
    toolbarOverflow,
    toolbarCanScrollLeft,
    toolbarCanScrollRight,
    updateToolbarScrollState,
    scrollToolbar,
    isExpanded,
    isAnimating,
    handleMouseDown,
    toggleExpand,
    handleSend,
    handleKeyDown,
    fileInputRef,
    handlePickFiles,
    handleNativeWebFileChange,
    handleTextChange,
    toggleSearchMode,
    handlePromptShortcut,
    isLoading,
    onStop,
    assistantName,
    onAssistantTap,
    onRecall,
    onTriggerShortcut,
    onManageShortcuts,
    onOpenTools,
    searchMode,
    ttsMode,
    onToggleTtsMode
  } = vm

  return (
    <div className={styles.containerMask}>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleNativeWebFileChange}
        style={{ display: 'none' }}
      />
      <div
        className={`${styles.constrainedBox} ${isExpanded ? styles.constrainedBoxExpanded : ''}`}
      >
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

        {/* Animated Toolbar */}
        <AnimatePresence initial={false}>
          {showToolbar && (
            <motion.div
              className={styles.toolbarWrapper}
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 2 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onAnimationComplete={updateToolbarScrollState}
            >
              <div className={styles.toolbarRow}>
                {toolbarOverflow && (
                  <button
                    type="button"
                    className={styles.toolbarScrollBtn}
                    onClick={() => scrollToolbar(-1)}
                    disabled={!toolbarCanScrollLeft}
                    aria-label={t('input.toolbar_scroll_left', '向左滚动工具栏')}
                    title={t('input.toolbar_scroll_left', '向左滚动')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div
                  ref={toolbarViewportRef}
                  className={styles.toolbarViewport}
                  onScroll={updateToolbarScrollState}
                >
                  <div className={styles.toolbarScroll}>
                    <QuickActionChip
                      icon={<Paperclip size={14} />}
                      label={t('input.upload_attachment', '上传附件')}
                      onClick={handlePickFiles}
                    />
                    <QuickActionChip
                      icon={<Zap size={14} />}
                      label={t('input.shortcut_command', '快捷指令')}
                      onClick={handlePromptShortcut}
                    />
                    <QuickActionChip
                      icon={
                        searchMode ? (
                          <Globe size={14} />
                        ) : (
                          <span style={{ opacity: 0.5 }}>
                            <Globe size={14} />
                          </span>
                        )
                      }
                      label={
                        searchMode
                          ? t('settings.web_search_mode_tool')
                          : t('settings.web_search_mode_off')
                      }
                      isActive={searchMode}
                      onClick={toggleSearchMode}
                    />
                    {onRecall && (
                      <QuickActionChip
                        icon={<BookOpen size={14} />}
                        label={t('settings.recall_memories')}
                        onClick={onRecall}
                      />
                    )}
                    {onToggleTtsMode && (
                      <QuickActionChip
                        icon={<Volume2 size={14} />}
                        label={
                          ttsMode === 'always'
                            ? t('agent.chat.tts_always', '始终朗读')
                            : t('agent.chat.tts_manual', '手动朗读')
                        }
                        isActive={ttsMode === 'always'}
                        onClick={onToggleTtsMode}
                      />
                    )}
                  </div>
                </div>
                {toolbarOverflow && (
                  <button
                    type="button"
                    className={styles.toolbarScrollBtn}
                    onClick={() => scrollToolbar(1)}
                    disabled={!toolbarCanScrollRight}
                    aria-label={t('input.toolbar_scroll_right', '向右滚动工具栏')}
                    title={t('input.toolbar_scroll_right', '向右滚动')}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Card */}
        <div
          className={`${styles.inputCard} ${isExpanded ? styles.inputCardExpanded : ''} ${isAnimating ? styles.inputCardAnimating : ''}`}
        >
          <div className={styles.topRow}>
            <div className={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                className={`${styles.textarea} ${isExpanded ? styles.textareaExpanded : ''}`}
                placeholder={t('agent.chat.input_hint', 'Type a message...')}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
            </div>

            {isExpanded && (
              <div
                className={styles.resizeHandle}
                onMouseDown={handleMouseDown}
                title={t('input.drag_resize', '拖拽调整高度')}
              >
                <div className={styles.resizeHandleIcon}>
                  <span />
                  <span />
                </div>
              </div>
            )}

            {/* Expand/Collapse Toggle Button */}
            <button
              className={styles.expandToggleBtn}
              onClick={toggleExpand}
              type="button"
              title={
                isExpanded ? t('input.collapse', '折叠输入框') : t('input.expand', '展开输入框')
              }
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          <div className={styles.bottomRow}>
            <button
              className={styles.appMenuBtn}
              onClick={() =>
                setShowToolbar((prev) => {
                  const next = !prev
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('baishou_toolbar_open', String(next))
                  }
                  return next
                })
              }
              type="button"
            >
              {showToolbar ? <LayoutGrid size={20} /> : <Menu size={20} />}
            </button>

            <div className={styles.sendBtnWrapper}>
              {isLoading ? (
                <motion.button
                  className={`${styles.actionBtn} ${styles.stopBtn}`}
                  onClick={onStop}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                >
                  <MdStop size={20} />
                </motion.button>
              ) : (
                <motion.button
                  className={`${styles.actionBtn} ${styles.sendBtn} ${!text.trim() && attachments.length === 0 ? styles.sendBtnDisabled : ''}`}
                  onClick={handleSend}
                  disabled={!text.trim() && attachments.length === 0}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                >
                  <MdSend size={18} />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
