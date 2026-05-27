import React, { useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react'
import styles from './InputBar.module.css'
import type { MockChatAttachment } from '@baishou/shared'

import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
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

export interface InputBarProps {
  isLoading: boolean
  onSend: (text: string, attachments?: MockChatAttachment[], searchMode?: boolean) => void
  onStop?: () => void
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  onTriggerShortcut?: () => void
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'off' | 'always' | 'manual'
  onToggleTtsMode?: () => void
}

export interface InputBarRef {
  insertText: (text: string) => void
  focus: () => void
}

export const InputBar = React.forwardRef<InputBarRef, InputBarProps>(
  (
    {
      isLoading,
      onSend,
      onStop,
      assistantName,
      onAssistantTap,
      onRecall,
      onTriggerShortcut,
      onManageShortcuts,
      onOpenTools,
      searchMode = false,
      onToggleSearchMode,
      ttsMode = 'manual',
      onToggleTtsMode
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [text, setText] = useState('')
    const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
    const [showToolbar, setShowToolbar] = useState(() => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('baishou_toolbar_open') === 'true'
      }
      return false
    })
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const toolbarViewportRef = useRef<HTMLDivElement>(null)
    const toast = useToast()
    const [toolbarOverflow, setToolbarOverflow] = useState(false)
    const [toolbarCanScrollLeft, setToolbarCanScrollLeft] = useState(false)
    const [toolbarCanScrollRight, setToolbarCanScrollRight] = useState(false)

    const updateToolbarScrollState = useCallback(() => {
      const el = toolbarViewportRef.current
      if (!el) {
        setToolbarOverflow(false)
        setToolbarCanScrollLeft(false)
        setToolbarCanScrollRight(false)
        return
      }
      const { scrollLeft, scrollWidth, clientWidth } = el
      const overflow = scrollWidth - clientWidth > 4
      setToolbarOverflow(overflow)
      setToolbarCanScrollLeft(overflow && scrollLeft > 4)
      setToolbarCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 4)
    }, [])

    const scrollToolbar = (direction: -1 | 1) => {
      toolbarViewportRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
    }

    useEffect(() => {
      if (!showToolbar) return

      const sync = () => updateToolbarScrollState()
      let disposed = false
      let resizeObserver: ResizeObserver | undefined
      let viewportEl: HTMLDivElement | null = null

      const attach = () => {
        viewportEl = toolbarViewportRef.current
        if (!viewportEl || disposed) return
        sync()
        viewportEl.addEventListener('scroll', sync, { passive: true })
        resizeObserver = new ResizeObserver(sync)
        resizeObserver.observe(viewportEl)
      }

      attach()
      const retryId = window.setTimeout(attach, 240)

      return () => {
        disposed = true
        window.clearTimeout(retryId)
        if (viewportEl) viewportEl.removeEventListener('scroll', sync)
        resizeObserver?.disconnect()
      }
    }, [showToolbar, updateToolbarScrollState])

    useImperativeHandle(ref, () => ({
      insertText: (newText) => {
        setText((prev) => (prev ? `${prev}\n${newText}` : newText))
        setTimeout(() => {
          if (textareaRef.current) textareaRef.current.focus()
        }, 0)
      },
      focus: () => {
        if (textareaRef.current) textareaRef.current.focus()
      }
    }))

    const [isExpanded, setIsExpanded] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    const isResizing = useRef(false)
    const startY = useRef(0)
    const startHeight = useRef(0)
    const expandedHeightRef = useRef(180)

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const deltaY = startY.current - e.clientY
      // 动态限制最大高度，至少为窗口高度减去顶栏和最小聊天区所需高度(180px)，且上限 600px，防止发送按钮被推到视口底部之外
      const maxHeight = Math.max(180, window.innerHeight - 180)
      const allowedMax = Math.min(600, maxHeight)
      const newHeight = Math.max(140, Math.min(startHeight.current + deltaY, allowedMax))
      const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`) as HTMLElement
      if (cardEl) {
        cardEl.style.height = `${newHeight}px`
        expandedHeightRef.current = newHeight
      }
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      isResizing.current = true
      startY.current = e.clientY
      const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`)
      if (cardEl) {
        startHeight.current = cardEl.getBoundingClientRect().height
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      e.preventDefault()
    }

    useEffect(() => {
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [])

    const toggleExpand = () => {
      const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`) as HTMLElement
      if (!cardEl) return

      const expanding = !isExpanded
      setIsAnimating(true)

      if (expanding) {
        const startHeight = cardEl.getBoundingClientRect().height
        cardEl.style.height = `${startHeight}px`

        cardEl.offsetHeight // force reflow

        setIsExpanded(true)

        // 延迟赋值，等待 React 渲染并挂载 transition 动画类，同时在变宽/变矮时对高度进行防溢出安全锁定
        setTimeout(() => {
          const maxHeight = Math.max(180, window.innerHeight - 180)
          const allowedMax = Math.min(600, maxHeight)
          const safeHeight = Math.max(140, Math.min(expandedHeightRef.current, allowedMax))
          cardEl.style.height = `${safeHeight}px`
          expandedHeightRef.current = safeHeight
          if (textareaRef.current) {
            textareaRef.current.style.height = '100%'
          }
        }, 30)

        setTimeout(() => {
          setIsAnimating(false)
        }, 700)
      } else {
        const currentHeight = cardEl.getBoundingClientRect().height
        expandedHeightRef.current = currentHeight

        setIsExpanded(false)

        // 1. 临时移除展开状态的 Class，清空内联高度，以便浏览器按折叠状态计算高度
        cardEl.classList.remove(styles.inputCardExpanded)
        const parentEl = cardEl.parentElement
        if (parentEl) {
          parentEl.classList.remove(styles.constrainedBoxExpanded)
        }
        if (textareaRef.current) {
          textareaRef.current.classList.remove(styles.textareaExpanded)
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`
        }
        cardEl.style.height = ''

        // 2. 测量出折叠后自适应状态的真实目标高度
        const targetHeight = cardEl.getBoundingClientRect().height

        // 3. 瞬间将状态和高度设回展开时，并强制回流，让 transition 知道起点
        cardEl.classList.add(styles.inputCardExpanded)
        if (parentEl) {
          parentEl.classList.add(styles.constrainedBoxExpanded)
        }
        if (textareaRef.current) {
          textareaRef.current.classList.add(styles.textareaExpanded)
          textareaRef.current.style.height = '100%'
        }
        cardEl.style.height = `${currentHeight}px`
        cardEl.offsetHeight // force reflow

        // 4. 延迟赋值终点高度，此时 React 应该已经重新渲染并移除了 inputCardExpanded
        setTimeout(() => {
          cardEl.style.height = `${targetHeight}px`
        }, 30)

        setTimeout(() => {
          setIsAnimating(false)
          if (cardEl) {
            cardEl.style.height = ''
          }
        }, 700)
      }
    }

    useEffect(() => {
      if (isExpanded) {
        if (textareaRef.current) {
          textareaRef.current.style.height = '100%'
        }
        return
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px` // approx 6 lines
      }
    }, [text, isExpanded])

    const handleSend = () => {
      if ((!text.trim() && attachments.length === 0) || isLoading) return
      onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined, searchMode)
      setText('')
      setAttachments([])
      if (textareaRef.current) {
        textareaRef.current.style.height = isExpanded ? '100%' : 'auto'
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    // 1. Tool Bar Chips
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handlePickFiles = async () => {
      // Phase 10: Use Electron Native `dialog` if available
      // @ts-ignore
      if (typeof window !== 'undefined' && window.api && window.api.pickFiles) {
        try {
          // @ts-ignore
          const newAtts = await window.api.pickFiles()
          if (newAtts && newAtts.length > 0) {
            const validAtts = newAtts.filter((att: any) => {
              if (att.isText && att.fileSize && att.fileSize > 512 * 1024) {
                toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
                return false
              }
              return true
            })
            if (validAtts.length > 0) {
              setAttachments((prev) => [...prev, ...validAtts])
            }
          }
        } catch (e) {
          console.error('Failed to pick file via IPC:', e)
        }
        return
      }

      // Fallback: Web standard <input type="file" />
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }

    const handleNativeWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return

      // Simulate reading via standard Web File API and converting to MockChatAttachment
      // Note: In a complete implementation we might read Blob/DataURL
      const newAtts = Array.from(e.target.files)
        .map((file) => {
          const isImage = file.type.startsWith('image/')
          const isPdf = file.type === 'application/pdf'
          const isText = file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)
          return {
            id: Math.random().toString(36).substring(7),
            fileName: file.name,
            filePath: URL.createObjectURL(file), // create local blob string to display
            isImage,
            isPdf,
            isText,
            fileSize: file.size
          }
        })
        .filter((att) => {
          if (att.isText && att.fileSize > 512 * 1024) {
            toast.showError(t('input.file_too_large', '文件大小超过限制 (最大 512KB)'))
            return false
          }
          return true
        })

      if (newAtts.length > 0) {
        setAttachments((prev) => [...prev, ...newAtts])
      }
      // Reset file input
      e.target.value = ''
    }

    const handlePromptShortcut = () => {
      if (onManageShortcuts) {
        onManageShortcuts()
      } else if (onTriggerShortcut) {
        onTriggerShortcut()
      }
    }

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value

      // Trigger shortcut modal if '/' is just typed
      if (val.endsWith('/') && val.length > text.length) {
        if (onTriggerShortcut) onTriggerShortcut()
      }
      setText(val)
    }

    const toggleSearchMode = () => onToggleSearchMode?.()

    const QuickActionChip = ({
      icon,
      label,
      onClick,
      isActive = false
    }: {
      icon: React.ReactNode
      label: string
      onClick?: () => void
      isActive?: boolean
    }) => (
      <button
        className={`${styles.quickActionChip} ${isActive ? styles.chipActive : ''}`}
        onClick={onClick}
        type="button"
      >
        <span className={styles.chipIcon}>{icon}</span>
        <span className={styles.chipLabel}>{label}</span>
      </button>
    )

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
                        {(att.isPdf || att.isText) ? <FileText size={18} /> : <Folder size={18} />}
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
                          ? t('agent.chat.tts_always', '始终播放')
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
)

InputBar.displayName = 'InputBar'
