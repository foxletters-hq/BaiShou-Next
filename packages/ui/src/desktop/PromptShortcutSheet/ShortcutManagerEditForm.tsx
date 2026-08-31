import React from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../Input/Input'
import styles from './ShortcutManagerDialog.module.css'

interface ShortcutManagerEditFormProps {
  draftName: string
  draftCommand: string
  draftContent: string
  onDraftNameChange: (v: string) => void
  onDraftCommandChange: (v: string) => void
  onDraftContentChange: (v: string) => void
  onCancel: () => void
  onSave: () => void
}

export const ShortcutManagerEditForm: React.FC<ShortcutManagerEditFormProps> = ({
  draftName,
  draftCommand,
  draftContent,
  onDraftNameChange,
  onDraftCommandChange,
  onDraftContentChange,
  onCancel,
  onSave
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>{t('shortcut.label_name', '展示名称')}</label>
        <Input
          fieldSize="small"
          value={draftName}
          onChange={(e) => onDraftNameChange(e.target.value)}
          placeholder={t('shortcut.label_hint', '例如: 翻译')}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          {t('shortcut.command_label', 'Skill 名称 (用于 / 触发)')}
        </label>
        <Input
          fieldSize="small"
          value={draftCommand}
          onChange={(e) => onDraftCommandChange(e.target.value)}
          placeholder={t('shortcut.command_hint', '例如: review, translate')}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>{t('shortcut.content_prompt', 'Skill 正文')}</label>
        <textarea
          className={styles.fieldTextarea}
          value={draftContent}
          onChange={(e) => onDraftContentChange(e.target.value)}
          placeholder={t('shortcut.content_hint', '在此输入将会插入到对话框的长文本预设指令...')}
        />
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSave}
          disabled={!draftContent.trim()}
        >
          {t('common.save', '保存')}
        </button>
      </div>
    </div>
  )
}
