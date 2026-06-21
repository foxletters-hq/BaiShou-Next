import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import type { UserProfileConfig } from './identity-settings.types'
import {
  removeRecentPersonaId,
  renameRecentPersonaId,
  updateRecentPersonaIds
} from './identity-recent.utils'

interface UseIdentitySettingsCardOptions {
  profile: UserProfileConfig
  onChange: (profile: UserProfileConfig) => void
}

export function useIdentitySettingsCard({ profile, onChange }: UseIdentitySettingsCardOptions) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()

  const activeId = profile.activePersonaId || 'Default'
  const allPersonas = profile.personas || {
    Default: { id: 'Default', facts: {} }
  }

  const mergedPersonas = allPersonas[activeId]
    ? allPersonas
    : { ...allPersonas, [activeId]: { id: activeId, facts: {} } }

  const currentFacts = mergedPersonas[activeId].facts || {}
  const [collapsed, setCollapsed] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [isFactModalOpen, setIsFactModalOpen] = useState(false)
  const [editKeyInput, setEditKeyInput] = useState('')
  const [editValInput, setEditValInput] = useState('')

  const handleSwitch = async (pid: string) => {
    if (pid !== activeId) {
      onChange({
        ...profile,
        activePersonaId: pid,
        recentPersonaIds: updateRecentPersonaIds(profile.recentPersonaIds, activeId, pid)
      })
      return
    }
    const newName = await dialog.prompt(t('settings.rename_identity_card', '重命名身份卡'), pid)
    if (newName && newName !== pid && !mergedPersonas[newName]) {
      const nextPersonas = { ...mergedPersonas }
      nextPersonas[newName] = { ...nextPersonas[pid], id: newName }
      delete nextPersonas[pid]
      onChange({
        ...profile,
        personas: nextPersonas,
        activePersonaId: newName,
        recentPersonaIds: renameRecentPersonaId(profile.recentPersonaIds, pid, newName)
      })
    }
  }

  const handleAddPersona = async () => {
    const newName = await dialog.prompt(t('settings.new_identity_card', '新建身份卡'), '')
    if (newName && !mergedPersonas[newName]) {
      const nextPersonas = {
        ...mergedPersonas,
        [newName]: { id: newName, facts: {} }
      }
      onChange({
        ...profile,
        personas: nextPersonas,
        activePersonaId: newName,
        recentPersonaIds: updateRecentPersonaIds(profile.recentPersonaIds, activeId, newName)
      })
    }
  }

  const startEdit = (k: string, v: string) => {
    setEditingKey(k)
    setEditKeyInput(k)
    setEditValInput(v)
    setIsFactModalOpen(true)
  }

  const handleAddFact = () => {
    setEditingKey(null)
    setEditKeyInput('')
    setEditValInput('')
    setIsFactModalOpen(true)
  }

  const saveEdit = () => {
    const k = editKeyInput.trim()
    const v = editValInput.trim()
    if (!k || !v) {
      toast.showError(t('settings.empty_identity_entry_error', '标签和内容不能为空'))
      return
    }

    if (k !== editingKey && currentFacts[k]) {
      toast.showError(t('settings.duplicate_identity_entry_error', '该标签已存在'))
      return
    }

    const nextFacts = { ...currentFacts }
    if (editingKey && editingKey !== k) {
      delete nextFacts[editingKey]
    }
    nextFacts[k] = v
    onChange({
      ...profile,
      personas: {
        ...mergedPersonas,
        [activeId]: { ...mergedPersonas[activeId], facts: nextFacts }
      }
    })
    setIsFactModalOpen(false)
  }

  const handleDeletePersona = async (pid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (Object.keys(mergedPersonas).length <= 1) {
      toast.showError(t('settings.identity_min_one', '至少保留一张身份卡！'))
      return
    }
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace('$personaId', pid)
    )
    if (confirmed) {
      const nextPersonas = { ...mergedPersonas }
      delete nextPersonas[pid]
      const remainingIds = Object.keys(nextPersonas)
      onChange({
        ...profile,
        personas: nextPersonas,
        activePersonaId: remainingIds[0],
        recentPersonaIds: removeRecentPersonaId(profile.recentPersonaIds, pid)
      })
    }
  }

  const handleDeleteFact = async (k: string) => {
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', k)
    )
    if (confirmed) {
      const nextFacts = { ...currentFacts }
      delete nextFacts[k]
      onChange({
        ...profile,
        personas: {
          ...mergedPersonas,
          [activeId]: { ...mergedPersonas[activeId], facts: nextFacts }
        }
      })
    }
  }

  return {
    activeId,
    allPersonas: mergedPersonas,
    currentFacts,
    collapsed,
    setCollapsed,
    editingKey,
    isFactModalOpen,
    setIsFactModalOpen,
    editKeyInput,
    setEditKeyInput,
    editValInput,
    setEditValInput,
    handleSwitch,
    handleAddPersona,
    startEdit,
    handleAddFact,
    saveEdit,
    handleDeletePersona,
    handleDeleteFact
  }
}
