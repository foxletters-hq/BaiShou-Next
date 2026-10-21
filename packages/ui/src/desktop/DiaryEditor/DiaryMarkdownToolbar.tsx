import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Keyboard, X } from 'lucide-react'
import type { DiaryCmMarkdownMark } from '../../shared/diary-codemirror/types'
import { Modal } from '../Modal/Modal'
import styles from './DiaryMarkdownToolbar.module.css'

export interface DiaryMarkdownToolbarProps {
  onInsertText: (prefix: string, suffix?: string) => void
  onToggleLinePrefix?: (prefix: string) => void
  onInsertCodeBlock?: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleMark: (marker: DiaryCmMarkdownMark) => void
  onPickImages?: () => void
  pickingImages?: boolean
}

const SCROLL_STEP_PX = 148

function ToolbarDivider() {
  return <span className={styles.divider} aria-hidden />
}

export function DiaryMarkdownToolbar({
  onInsertText,
  onToggleLinePrefix,
  onInsertCodeBlock,
  onUndo,
  onRedo,
  onToggleMark,
  onPickImages,
  pickingImages = false
}: DiaryMarkdownToolbarProps) {
  const { t } = useTranslation()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    []
  )
  const modKey = isMac ? '⌘' : 'Ctrl'

  const shortcutSections = useMemo(
    () => [
      {
        title: t('diary.shortcuts_section_general', '常用操作'),
        items: [
          {
            label: t('diary.shortcut_quick_save', '保存草稿（不退出）'),
            keys: [modKey, 'S']
          },
          {
            label: t('diary.toolbar_undo', '撤销'),
            keys: [modKey, 'Z']
          },
          {
            label: t('diary.toolbar_redo', '重做'),
            keys: isMac ? ['⌘', 'Shift', 'Z'] : ['Ctrl', 'Y']
          },
          {
            label: t('diary.shortcut_search', '查找 / 替换'),
            keys: [modKey, 'F']
          }
        ]
      },
      {
        title: t('diary.shortcuts_section_markdown', 'Markdown 格式'),
        items: [
          {
            label: t('diary.toolbar_bold', '加粗'),
            keys: [modKey, 'B']
          },
          {
            label: t('diary.toolbar_italic', '斜体'),
            keys: [modKey, 'I']
          },
          {
            label: t('diary.toolbar_strikethrough', '删除线'),
            keys: [modKey, 'Shift', 'X']
          },
          {
            label: t('diary.toolbar_code', '行内代码'),
            keys: [modKey, 'Q']
          },
          {
            label: t('diary.toolbar_code_block', '代码块'),
            keys: [modKey, 'W']
          },
          {
            label: t('diary.shortcut_link', '插入链接'),
            keys: [modKey, 'K']
          },
          {
            label: t('diary.shortcut_table', '插入表格'),
            keys: [modKey, 'Shift', 'T']
          }
        ]
      },
      {
        title: t('diary.shortcuts_section_editing', '排版与交互'),
        items: [
          {
            label: t('diary.shortcut_continue_block', '列表 / 引用自动续行（空行再按退出）'),
            keys: ['Enter']
          },
          {
            label: t('diary.shortcut_indent', '增加 / 减少缩进'),
            keys: ['Tab', 'Shift + Tab']
          },
          {
            label: t('diary.shortcut_open_link', '打开文内链接'),
            keys: [`${modKey} + 单击`]
          }
        ]
      }
    ],
    [isMac, modKey, t]
  )

  useEffect(() => {
    if (!shortcutsOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcutsOpen])

  const handleLinePrefix = useCallback(
    (prefix: string) => {
      if (onToggleLinePrefix) {
        onToggleLinePrefix(prefix)
      } else {
        onInsertText(prefix)
      }
    },
    [onToggleLinePrefix, onInsertText]
  )

  const handleCodeBlock = useCallback(() => {
    if (onInsertCodeBlock) {
      onInsertCodeBlock()
    } else {
      onInsertText('```\n', '\n```')
    }
  }, [onInsertCodeBlock, onInsertText])

  const updateScrollAffordance = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maxScroll = viewport.scrollWidth - viewport.clientWidth
    if (maxScroll <= 2) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    setCanScrollLeft(viewport.scrollLeft > 2)
    setCanScrollRight(maxScroll - viewport.scrollLeft > 2)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    updateScrollAffordance()

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollAffordance) : null
    observer?.observe(viewport)
    if (viewport.firstElementChild) {
      observer?.observe(viewport.firstElementChild)
    }

    window.addEventListener('resize', updateScrollAffordance)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateScrollAffordance)
    }
  }, [updateScrollAffordance])

  const scrollToolbar = useCallback((direction: -1 | 1) => {
    viewportRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' })
  }, [])

  const showScrollControls = canScrollLeft || canScrollRight

  return (
    <div className={styles.toolbar} data-diary-markdown-toolbar>
      {showScrollControls ? (
        <button
          type="button"
          className={styles.scrollBtn}
          onClick={() => scrollToolbar(-1)}
          disabled={!canScrollLeft}
          title={t('diary.toolbar_scroll_left', '向左滚动工具栏')}
          aria-label={t('diary.toolbar_scroll_left', '向左滚动工具栏')}
        >
          <ChevronLeft className={styles.scrollIcon} />
        </button>
      ) : null}

      <div ref={viewportRef} className={styles.viewport} onScroll={updateScrollAffordance}>
        <div className={styles.scroll}>
          <button
            type="button"
            className={styles.btn}
            onClick={onUndo}
            title={t('diary.toolbar_undo', '撤销')}
            aria-label={t('diary.toolbar_undo', '撤销')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 14 4 9l5-5" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={onRedo}
            title={t('diary.toolbar_redo', '重做')}
            aria-label={t('diary.toolbar_redo', '重做')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 14 5-5-5-5" />
              <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
            </svg>
          </button>

          <ToolbarDivider />

          <button
            type="button"
            className={`${styles.btn} ${styles.btnMark}`}
            onClick={() => onToggleMark('**')}
            title={t('diary.toolbar_bold', '加粗')}
            aria-label={t('diary.toolbar_bold', '加粗')}
          >
            B
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnMark} ${styles.italic}`}
            onClick={() => onToggleMark('*')}
            title={t('diary.toolbar_italic', '斜体')}
            aria-label={t('diary.toolbar_italic', '斜体')}
          >
            I
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnMark} ${styles.strike}`}
            onClick={() => onToggleMark('~~')}
            title={t('diary.toolbar_strikethrough', '删除线')}
            aria-label={t('diary.toolbar_strikethrough', '删除线')}
          >
            S
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => onToggleMark('`')}
            title={`${t('diary.toolbar_code', '行内代码')} (${modKey}+Q)`}
            aria-label={t('diary.toolbar_code', '行内代码')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>

          <ToolbarDivider />

          <button
            type="button"
            className={styles.btn}
            onClick={() => handleLinePrefix('> ')}
            title={t('diary.toolbar_quote', '引用')}
            aria-label={t('diary.toolbar_quote', '引用')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.17 6A5.001 5.001 0 0 0 2 11c0 2.21 1.79 4 4 4 .55 0 1-.45 1-1v-1H6c-1.1 0-2-.9-2-2 0-1.1.9-2 2-2h1.17zM17.17 6A5.001 5.001 0 0 0 12 11c0 2.21 1.79 4 4 4 .55 0 1-.45 1-1v-1h-1c-1.1 0-2-.9-2-2 0-1.1.9-2 2-2h1.17z" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => handleLinePrefix('- ')}
            title={t('diary.toolbar_list', '无序列表')}
            aria-label={t('diary.toolbar_list', '无序列表')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={handleCodeBlock}
            title={`${t('diary.toolbar_code_block', '代码块')} (${modKey}+W)`}
            aria-label={t('diary.toolbar_code_block', '代码块')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <polyline points="9 9 6 12 9 15" />
              <polyline points="15 9 18 12 15 15" />
            </svg>
          </button>

          <ToolbarDivider />

          <button
            type="button"
            className={`${styles.btn} ${styles.hash}`}
            onClick={() => onInsertText('#')}
            title={t('diary.toolbar_insert_tag', '插入标签')}
            aria-label={t('diary.toolbar_insert_tag', '插入标签')}
          >
            #
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => handleLinePrefix('##### ')}
            title={t('diary.toolbar_insert_h5', '插入五级标题')}
            aria-label={t('diary.toolbar_insert_h5', '插入五级标题')}
          >
            H5
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => handleLinePrefix('###### ')}
            title={t('diary.toolbar_insert_h6', '插入六级标题')}
            aria-label={t('diary.toolbar_insert_h6', '插入六级标题')}
          >
            H6
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={onPickImages}
            disabled={!onPickImages || pickingImages}
            title={t('diary.toolbar_insert_image', '插入图片')}
            aria-label={t('diary.toolbar_insert_image', '插入图片')}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
        </div>
      </div>

      {showScrollControls ? (
        <button
          type="button"
          className={styles.scrollBtn}
          onClick={() => scrollToolbar(1)}
          disabled={!canScrollRight}
          title={t('diary.toolbar_scroll_right', '向右滚动工具栏')}
          aria-label={t('diary.toolbar_scroll_right', '向右滚动工具栏')}
        >
          <ChevronRight className={styles.scrollIcon} />
        </button>
      ) : null}

      <button
        type="button"
        className={`${styles.btn} ${styles.shortcutTriggerBtn}`}
        onClick={() => setShortcutsOpen(true)}
        title={t('diary.toolbar_shortcuts', '快捷键说明')}
        aria-label={t('diary.toolbar_shortcuts', '快捷键说明')}
      >
        <Keyboard className={styles.icon} />
        <span className={styles.shortcutTriggerLabel}>
          {t('diary.toolbar_shortcuts_short', '快捷键')}
        </span>
      </button>

      <Modal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        animation="fade"
        className={styles.shortcutsModal}
      >
        <div className={styles.shortcutsHeader}>
          <span className={styles.shortcutsTitle}>
            {t('diary.shortcuts_modal_title', '编辑器快捷键')}
          </span>
          <button
            type="button"
            className={styles.shortcutsCloseBtn}
            onClick={() => setShortcutsOpen(false)}
            aria-label={t('common.close', '关闭')}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.shortcutsBody}>
          {shortcutSections.map((section) => (
            <div key={section.title} className={styles.shortcutSection}>
              <div className={styles.shortcutSectionTitle}>{section.title}</div>
              <div className={styles.shortcutList}>
                {section.items.map((item) => (
                  <div key={item.label} className={styles.shortcutRow}>
                    <span className={styles.shortcutLabel}>{item.label}</span>
                    <span className={styles.shortcutKeys}>
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={k}>
                          {idx > 0 && <span className={styles.shortcutKeyPlus}>+</span>}
                          <kbd className={styles.kbd}>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
