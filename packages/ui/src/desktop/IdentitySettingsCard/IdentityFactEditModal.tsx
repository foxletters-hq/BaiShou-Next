import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import styles from './IdentitySettingsCard.module.css'

interface IdentityFactEditModalProps {
  isOpen: boolean
  editingKey: string | null
  editKeyInput: string
  editValInput: string
  onKeyChange: (value: string) => void
  onValueChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export const IdentityFactEditModal: React.FC<IdentityFactEditModalProps> = ({
  isOpen,
  editingKey,
  editKeyInput,
  editValInput,
  onKeyChange,
  onValueChange,
  onSave,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingKey
          ? t('settings.edit_identity_entry', '编辑条目')
          : t('settings.add_identity_entry', '添加条目')
      }
    >
      <div className={styles.modalBody}>
        <div className={styles.modalField}>
          <label>{t('settings.identity_key', '标签')}</label>
          <Input
            value={editKeyInput}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={t('settings.identity_key_hint', '如：生日、职业')}
            autoFocus
          />
        </div>
        <div className={styles.modalField}>
          <label>{t('settings.identity_value', '内容')}</label>
          <Input
            value={editValInput}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={t('settings.identity_value_hint', '如：2000-05-20')}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') onSave()
            }}
          />
        </div>
        <div className={styles.modalActions}>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button variant="elevated" onClick={onSave}>
            {t('common.save', '保存')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
