import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSkill } from '@baishou/shared'
import { Button, Input, Modal } from '@baishou/ui'
import { isSkillNameLockedForEdit } from '../../utils/workspace-skill-launch.util'
import styles from './WorkbenchSkillEditorDialog.module.css'

export const WorkbenchSkillEditorDialog: React.FC<{
  open: boolean
  skill: AgentSkill | null
  busy: boolean
  onClose: () => void
  onSave: (input: { name: string; description: string; content: string }) => void
}> = ({ open, skill, busy, onClose, onSave }) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const nameLocked = isSkillNameLockedForEdit(skill?.source)
  const officialHint = (skill?.source ?? 'software') === 'software'

  useEffect(() => {
    if (!skill) return
    setName(skill.name)
    setDescription(skill.description)
    setContent(skill.content)
  }, [skill])

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick={!busy}
      animation="fade"
      className={styles.modal}
      title={t('workbench.skills_edit_title', {
        name: skill?.name ?? '',
        defaultValue: '编辑 /{{name}}'
      })}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!skill || busy) return
          onSave({
            name: nameLocked ? skill.name : name,
            description,
            content
          })
        }}
      >
        {officialHint ? (
          <p className={styles.hint}>
            {t(
              'workbench.skills_edit_official_hint',
              '保存后会写入你的全局技能，不会修改官方文件'
            )}
          </p>
        ) : null}
        <label className={styles.field}>
          <span>{t('workbench.skills_edit_name', '名称')}</span>
          <Input
            value={name}
            disabled={nameLocked || busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{t('workbench.skills_edit_description', '说明')}</span>
          <Input
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{t('workbench.skills_edit_content', '内容')}</span>
          <textarea
            className={styles.textarea}
            value={content}
            disabled={busy}
            rows={12}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <div className={styles.footer}>
          <Button type="button" variant="outlined" disabled={busy} onClick={onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button type="submit" variant="elevated" disabled={busy || !skill} isLoading={busy}>
            {t('common.save', '保存')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
