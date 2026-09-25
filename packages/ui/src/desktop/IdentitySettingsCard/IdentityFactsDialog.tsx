import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { applyIdentityFactEdit, deleteIdentityFact } from '../../shared/identity-facts.util'
import { IdentityFactsList } from './IdentityFactsList'
import { IdentityFactEditModal } from './IdentityFactEditModal'
import styles from './IdentitySettingsCard.module.css'

export interface IdentityFactsDialogProps {
  isOpen: boolean
  personaName: string
  facts: Record<string, string>
  onClose: () => void
  onChangeFacts: (facts: Record<string, string>) => void | Promise<void>
}

export const IdentityFactsDialog: React.FC<IdentityFactsDialogProps> = ({
  isOpen,
  personaName,
  facts,
  onClose,
  onChangeFacts
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [isFactModalOpen, setIsFactModalOpen] = useState(false)
  const [editKeyInput, setEditKeyInput] = useState('')
  const [editValInput, setEditValInput] = useState('')

  const startEdit = (key: string, value: string) => {
    setEditingKey(key)
    setEditKeyInput(key)
    setEditValInput(value)
    setIsFactModalOpen(true)
  }

  const handleAddFact = () => {
    setEditingKey(null)
    setEditKeyInput('')
    setEditValInput('')
    setIsFactModalOpen(true)
  }

  const saveEdit = () => {
    const result = applyIdentityFactEdit(facts, editingKey, editKeyInput, editValInput)
    if (!result.ok) {
      toast.showError(
        result.error === 'empty'
          ? t('settings.empty_identity_entry_error', '标签和内容不能为空')
          : t('settings.duplicate_identity_entry_error', '该标签已存在')
      )
      return
    }
    void onChangeFacts(result.facts)
    setIsFactModalOpen(false)
  }

  const handleDeleteFact = async (key: string) => {
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', key)
    )
    if (!confirmed) return
    await onChangeFacts(deleteIdentityFact(facts, key))
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlayClick
        animation="fade"
        title={t('settings.identity_attributes_title', { name: personaName })}
      >
        <div className={styles.factsDialogBody}>
          <IdentityFactsList
            compact
            currentFacts={facts}
            onAddFact={handleAddFact}
            onEditFact={startEdit}
            onDeleteFact={(key) => void handleDeleteFact(key)}
          />
        </div>
      </Modal>
      <IdentityFactEditModal
        isOpen={isFactModalOpen}
        editingKey={editingKey}
        editKeyInput={editKeyInput}
        editValInput={editValInput}
        onKeyChange={setEditKeyInput}
        onValueChange={setEditValInput}
        onSave={saveEdit}
        onClose={() => setIsFactModalOpen(false)}
        zIndex={1100}
      />
    </>
  )
}
