import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { useDialog } from '../Dialog'
import { useNativeToast } from '../Toast'
import { applyIdentityFactEdit, deleteIdentityFact } from '../../shared/identity-facts.util'
import { IdentitySettingsFactsSection } from './IdentitySettingsFactsSection'
import { IdentitySettingsFactModal } from './IdentitySettingsFactModal'

export interface IdentityFactsDialogProps {
  visible: boolean
  personaName: string
  facts: Record<string, string>
  onClose: () => void
  onChangeFacts: (facts: Record<string, string>) => void | Promise<void>
}

export const IdentityFactsDialog: React.FC<IdentityFactsDialogProps> = ({
  visible,
  personaName,
  facts,
  onClose,
  onChangeFacts
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
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
      toast.showToast(
        result.error === 'empty'
          ? t('settings.empty_identity_entry_error', '标签和内容不能为空')
          : t('settings.duplicate_identity_entry_error', '该标签已存在'),
        'error'
      )
      return
    }
    void onChangeFacts(result.facts)
    setIsFactModalOpen(false)
  }

  const handleDeleteFact = async (key: string) => {
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', key),
      { confirmText: t('common.confirm', '确定'), destructive: true }
    )
    if (!confirmed) return
    await onChangeFacts(deleteIdentityFact(facts, key))
  }

  return (
    <>
      <Modal
        visible={visible}
        title={t('settings.identity_attributes_title', { name: personaName })}
        onClose={onClose}
      >
        <ScrollView>
          <IdentitySettingsFactsSection
            currentFacts={facts}
            onAddFact={handleAddFact}
            onStartEdit={startEdit}
            onDeleteFact={(key) => void handleDeleteFact(key)}
          />
        </ScrollView>
      </Modal>
      <IdentitySettingsFactModal
        visible={isFactModalOpen}
        editingKey={editingKey}
        editKeyInput={editKeyInput}
        editValInput={editValInput}
        onEditKeyChange={setEditKeyInput}
        onEditValChange={setEditValInput}
        onClose={() => setIsFactModalOpen(false)}
        onSave={saveEdit}
      />
    </>
  )
}
