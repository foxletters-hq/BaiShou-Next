import React from 'react'
import { useTranslation } from 'react-i18next'
import type { NotebookCardTone } from '@baishou/shared'
import { Button, Input } from '@baishou/ui'
import { KnowledgeDialog } from './KnowledgeDialog'
import { NotebookCoverEditor } from './NotebookCoverEditor'
import { type NotebookCoverMode } from './notebook-cover-mode'
import styles from './KnowledgePage.module.css'

export function KnowledgeCreateNotebookDialog({
  open,
  busy,
  name,
  description,
  createTone,
  createIcon,
  createCoverPath,
  createCoverName,
  createCoverMode,
  onClose,
  onNameChange,
  onDescriptionChange,
  onToneChange,
  onModeChange,
  onPickIcon,
  onUploadImage,
  onClearImage,
  onCreate
}: {
  open: boolean
  busy: boolean
  name: string
  description: string
  createTone: NotebookCardTone | ''
  createIcon: string
  createCoverPath: string
  createCoverName: string
  createCoverMode: NotebookCoverMode
  onClose: () => void
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onToneChange: (tone: NotebookCardTone) => void
  onModeChange: (mode: NotebookCoverMode) => void
  onPickIcon: () => void
  onUploadImage: () => void
  onClearImage: () => void
  onCreate: () => void
}) {
  const { t } = useTranslation()
  return (
    <KnowledgeDialog
      open={open}
      onClose={onClose}
      closeDisabled={busy}
      title={t('knowledge.new_notebook', '新建笔记本')}
      aria-label={t('knowledge.new_notebook', '新建笔记本')}
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('knowledge.notebook_name', '名称')}</span>
        <Input
          fieldSize="small"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('knowledge.notebook_name_placeholder', '笔记本名称')}
          autoFocus
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('knowledge.notebook_desc', '描述（可选）')}</span>
        <textarea
          className={styles.fieldTextarea}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </label>
      <NotebookCoverEditor
        className={styles.field}
        labelClassName={styles.fieldLabel}
        mode={createCoverMode}
        onModeChange={onModeChange}
        tone={createTone}
        onToneChange={onToneChange}
        icon={createIcon}
        onPickIcon={onPickIcon}
        onUploadImage={onUploadImage}
        onClearImage={onClearImage}
        hasImage={Boolean(createCoverPath)}
        imageName={createCoverName}
        disabled={busy}
        labels={{
          cover: t('knowledge.notebook_cover', '笔记本封面'),
          emoji: t('knowledge.cover_mode_emoji', 'emoji'),
          pickIcon: t('knowledge.pick_cover_icon', '选择图标'),
          uploadImage: t('knowledge.upload_cover_image', '上传图片'),
          clearImage: t('knowledge.clear_cover_image', '清除图片')
        }}
      />
      <div className={styles.dialogActions}>
        <Button type="button" onClick={onClose} disabled={busy}>
          {t('common.cancel', '取消')}
        </Button>
        <Button type="button" onClick={onCreate} disabled={busy || !name.trim()}>
          {t('knowledge.create_action', '创建')}
        </Button>
      </div>
    </KnowledgeDialog>
  )
}
