import React from 'react'
import { useTranslation } from 'react-i18next'
import type { DiaryCmMarkdownMark } from '../../shared/diary-codemirror/types'
import styles from './DiaryMarkdownToolbar.module.css'

export interface DiaryMarkdownToolbarProps {
  onInsertText: (prefix: string, suffix?: string) => void
  onUndo: () => void
  onRedo: () => void
  onToggleMark: (marker: DiaryCmMarkdownMark) => void
  onPickImages?: () => void
  pickingImages?: boolean
}

function ToolbarDivider() {
  return <span className={styles.divider} aria-hidden />
}

export function DiaryMarkdownToolbar({
  onInsertText,
  onUndo,
  onRedo,
  onToggleMark,
  onPickImages,
  pickingImages = false
}: DiaryMarkdownToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.toolbar}>
      <div className={styles.viewport}>
        <div className={styles.scroll}>
          <button
            type="button"
            className={styles.btn}
            onClick={onUndo}
            title={t('diary.toolbar_undo', '撤销')}
            aria-label={t('diary.toolbar_undo', '撤销')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            title={t('diary.toolbar_code', '行内代码')}
            aria-label={t('diary.toolbar_code', '行内代码')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>

          <ToolbarDivider />

          <button
            type="button"
            className={styles.btn}
            onClick={() => onInsertText('> ')}
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
            onClick={() => onInsertText('- ')}
            title={t('diary.toolbar_list', '无序列表')}
            aria-label={t('diary.toolbar_list', '无序列表')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>

          <ToolbarDivider />

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.hash}`}
            onClick={() => onInsertText('#')}
            title={t('diary.toolbar_insert_tag', '插入标签')}
            aria-label={t('diary.toolbar_insert_tag', '插入标签')}
          >
            #
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => onInsertText('##### ')}
            title={t('diary.toolbar_insert_h5', '插入五级标题')}
            aria-label={t('diary.toolbar_insert_h5', '插入五级标题')}
          >
            H5
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => onInsertText('###### ')}
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
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
