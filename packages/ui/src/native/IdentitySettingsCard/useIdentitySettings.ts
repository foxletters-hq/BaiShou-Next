import { useState } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '../Toast'
import type { NativeIdentitySettingsCardProps } from './identity-settings.types'

export function useIdentitySettings({ profile, onChange }: NativeIdentitySettingsCardProps) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const [collapsed, setCollapsed] = useState(true)
  const [isFactModalOpen, setIsFactModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editKeyInput, setEditKeyInput] = useState('')
  const [editValInput, setEditValInput] = useState('')

  const activeId = profile.activePersonaId || 'Default'
  const allPersonas = profile.personas || {
    Default: { id: 'Default', facts: {} }
  }

  if (!allPersonas[activeId]) {
    allPersonas[activeId] = { id: activeId, facts: {} }
  }

  const currentFacts = allPersonas[activeId].facts || {}

  const handleSwitch = (pid: string) => {
    if (pid !== activeId) {
      onChange({ ...profile, activePersonaId: pid })
    } else {
      Alert.prompt(
        t('settings.rename_identity_card', '重命名身份卡'),
        undefined,
        (newName) => {
          if (newName && newName !== pid && !allPersonas[newName]) {
            const nextPersonas = { ...allPersonas }
            nextPersonas[newName] = { ...nextPersonas[pid], id: newName }
            delete nextPersonas[pid]
            onChange({
              ...profile,
              personas: nextPersonas,
              activePersonaId: newName
            })
          }
        },
        'plain-text',
        pid
      )
    }
  }

  const handleAddPersona = () => {
    Alert.prompt(
      t('settings.new_identity_card', '新建身份卡'),
      undefined,
      (newName) => {
        if (newName && !allPersonas[newName]) {
          const nextPersonas = {
            ...allPersonas,
            [newName]: { id: newName, facts: {} }
          }
          onChange({
            ...profile,
            personas: nextPersonas,
            activePersonaId: newName
          })
        }
      },
      'plain-text'
    )
  }

  const handleDeletePersona = (pid: string) => {
    if (Object.keys(allPersonas).length <= 1) {
      toast.showToast(t('settings.identity_min_one', '至少保留一张身份卡！'), 'error')
      return
    }
    Alert.alert(
      t('common.confirm', '确认'),
      t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace('$personaId', pid),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          style: 'destructive',
          onPress: () => {
            const nextPersonas = { ...allPersonas }
            delete nextPersonas[pid]
            const remainingIds = Object.keys(nextPersonas)
            onChange({
              ...profile,
              personas: nextPersonas,
              activePersonaId: remainingIds[0]
            })
          }
        }
      ]
    )
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
      toast.showToast(t('settings.empty_identity_entry_error', '标签和内容不能为空'), 'error')
      return
    }

    if (k !== editingKey && currentFacts[k]) {
      toast.showToast(t('settings.duplicate_identity_entry_error', '该标签已存在'), 'error')
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
        ...allPersonas,
        [activeId]: { ...allPersonas[activeId], facts: nextFacts }
      }
    })
    setIsFactModalOpen(false)
  }

  const handleDeleteFact = (k: string) => {
    Alert.alert(
      t('common.confirm', '确认'),
      t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', k),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          style: 'destructive',
          onPress: () => {
            const nextFacts = { ...currentFacts }
            delete nextFacts[k]
            onChange({
              ...profile,
              personas: {
                ...allPersonas,
                [activeId]: { ...allPersonas[activeId], facts: nextFacts }
              }
            })
          }
        }
      ]
    )
  }

  return {
    collapsed,
    setCollapsed,
    isFactModalOpen,
    setIsFactModalOpen,
    editingKey,
    editKeyInput,
    setEditKeyInput,
    editValInput,
    setEditValInput,
    activeId,
    allPersonas,
    currentFacts,
    handleSwitch,
    handleAddPersona,
    handleDeletePersona,
    startEdit,
    handleAddFact,
    saveEdit,
    handleDeleteFact
  }
}
