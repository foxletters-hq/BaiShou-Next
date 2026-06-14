import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserProfileStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { MdAdd, MdArrowBack } from 'react-icons/md'
import {
  Input,
  Pagination,
  useDialog,
  useToast,
  removeRecentPersonaId,
  renameRecentPersonaId,
  updateRecentPersonaIds
} from '@baishou/ui'
import './ManagementPane.css'

const PAGE_SIZE = 10

interface PersonaInfo {
  id: string
  factsCount: number
}

export const IdentityCardManagementPane: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const toast = useToast()
  const { loadProfile } = useUserProfileStore() as { loadProfile?: () => Promise<void> }

  const [personas, setPersonas] = useState<PersonaInfo[]>([])
  const [activePersonaId, setActivePersonaId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const loadPersonas = useCallback(async () => {
    try {
      const profile = await (window as any).api?.profile?.getProfile()
      const personasMap = profile?.personas || {}
      const list: PersonaInfo[] = Object.keys(personasMap).map((id) => ({
        id,
        factsCount: Object.keys(personasMap[id]?.facts || {}).length
      }))
      setPersonas(list)
      setActivePersonaId(profile?.activePersonaId || Object.keys(personasMap)[0] || '')
    } catch (e) {
      console.warn('Load personas failed', e)
    }
  }, [])

  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredPersonas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return personas
    return personas.filter((p) => p.id.toLowerCase().includes(q))
  }, [personas, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPersonas.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedPersonas = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredPersonas.slice(start, start + PAGE_SIZE)
  }, [filteredPersonas, safePage])

  const showPagination = filteredPersonas.length > 0

  const saveProfile = async (userProfile: Record<string, unknown>) => {
    await (window as any).api?.profile?.saveProfile(userProfile)
    if (loadProfile) await loadProfile()
    await loadPersonas()
  }

  const handleCreate = async () => {
    const name = await dialog.prompt(
      t('settings.identity_name_prompt', '请输入身份卡名称'),
      '',
      t('settings.new_identity_card', '新建身份卡')
    )
    if (!name?.trim()) return
    if (personas.some((p) => p.id === name.trim())) {
      toast.showError(t('settings.identity_name_exists', '该身份卡已存在'))
      return
    }
    try {
      const userProfile = (await (window as any).api?.profile?.getProfile()) || {}
      const personasMap = userProfile.personas || {}
      personasMap[name.trim()] = { id: name.trim(), facts: {} }
      const previousActiveId = userProfile.activePersonaId || activePersonaId
      userProfile.personas = personasMap
      userProfile.activePersonaId = name.trim()
      userProfile.recentPersonaIds = updateRecentPersonaIds(
        userProfile.recentPersonaIds,
        previousActiveId,
        name.trim()
      )
      await saveProfile(userProfile)
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleSwitch = async (personaId: string) => {
    if (activePersonaId === personaId) return
    try {
      const userProfile = (await (window as any).api?.profile?.getProfile()) || {}
      const previousActiveId = userProfile.activePersonaId || activePersonaId
      userProfile.activePersonaId = personaId
      userProfile.recentPersonaIds = updateRecentPersonaIds(
        userProfile.recentPersonaIds,
        previousActiveId,
        personaId
      )
      await saveProfile(userProfile)
      setActivePersonaId(personaId)
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleRename = async (personaId: string) => {
    const newName = await dialog.prompt(
      t('settings.identity_name_prompt', '请输入身份卡名称'),
      personaId,
      t('settings.rename_identity_card', '重命名身份卡')
    )
    if (!newName?.trim() || newName.trim() === personaId) return
    if (personas.some((p) => p.id === newName.trim())) {
      toast.showError(t('settings.identity_name_exists', '该身份卡已存在'))
      return
    }
    try {
      const userProfile = (await (window as any).api?.profile?.getProfile()) || {}
      const personasMap = { ...userProfile.personas }
      personasMap[newName.trim()] = { ...personasMap[personaId], id: newName.trim() }
      delete personasMap[personaId]
      userProfile.personas = personasMap
      if (userProfile.activePersonaId === personaId) {
        userProfile.activePersonaId = newName.trim()
      }
      userProfile.recentPersonaIds = renameRecentPersonaId(
        userProfile.recentPersonaIds,
        personaId,
        newName.trim()
      )
      await saveProfile(userProfile)
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDelete = async (personaId: string) => {
    if (personas.length <= 1) {
      toast.showError(t('settings.identity_min_one', '至少保留一张身份卡！'))
      return
    }
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace(
        '$personaId',
        personaId
      )
    )
    if (!confirmed) return
    try {
      const userProfile = (await (window as any).api?.profile?.getProfile()) || {}
      const personasMap = { ...userProfile.personas }
      delete personasMap[personaId]
      userProfile.personas = personasMap
      if (userProfile.activePersonaId === personaId) {
        userProfile.activePersonaId = Object.keys(personasMap)[0]
      }
      userProfile.recentPersonaIds = removeRecentPersonaId(userProfile.recentPersonaIds, personaId)
      await saveProfile(userProfile)
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  return (
    <div className="settings-management-pane">
      <div className="settings-management-header">
        <button
          type="button"
          className="settings-management-back"
          onClick={() => navigate('/settings/general')}
          title={t('common.back', '返回')}
        >
          <MdArrowBack size={22} />
        </button>
        <h2 className="settings-management-title">
          {t('settings.manage_identity_cards', '管理身份卡')}
        </h2>
        <button
          type="button"
          className="settings-management-header-action"
          onClick={() => void handleCreate()}
        >
          <MdAdd size={18} />
          <span>{t('settings.create_new_identity', '创建新身份卡')}</span>
        </button>
      </div>

      <div className="settings-management-scroll">
        <div className="settings-management-card settings-management-list-card">
          <div className="settings-management-search">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.search_identity_placeholder', '搜索身份卡…')}
            />
          </div>

          {filteredPersonas.length === 0 ? (
            <div className="settings-management-empty">
              {t('settings.search_identity_empty', '没有匹配的身份卡')}
            </div>
          ) : null}

          {pagedPersonas.map((persona, index) => {
            const isActive = activePersonaId === persona.id
            const isLast = index === pagedPersonas.length - 1 && !showPagination
            return (
              <div
                key={persona.id}
                className={`settings-management-list-row ${!isLast ? 'settings-management-list-row-divider' : ''}`}
              >
                <div className="settings-management-row-main">
                  <span className="settings-management-row-title">{persona.id}</span>
                  <span className="settings-management-row-sub">
                    {t('settings.identity_facts_count', '{{count}} 条身份条目', {
                      count: persona.factsCount
                    })}
                  </span>
                </div>
                <div className="settings-management-row-actions">
                  <div className="settings-management-status-slot">
                    {isActive ? (
                      <span className="settings-management-status-current">
                        {t('settings.identity_current', '当前')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="settings-text-btn"
                        onClick={() => void handleSwitch(persona.id)}
                      >
                        {t('workspace.switch', '切换')}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="settings-text-btn"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                    onClick={() => void handleRename(persona.id)}
                  >
                    {t('common.rename', '重命名')}
                  </button>
                  {personas.length > 1 ? (
                    <button
                      type="button"
                      className="settings-text-btn"
                      style={{ color: '#ef4444' }}
                      onClick={() => void handleDelete(persona.id)}
                    >
                      {t('workspace.delete', '删除')}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}

          {showPagination ? (
            <div className="settings-management-list-pagination">
              <span className="settings-management-page-info">
                {t('workspace.page_info', '共 {{total}} 个 · 第 {{page}} / {{pages}} 页', {
                  total: filteredPersonas.length,
                  page: safePage,
                  pages: totalPages
                })}
              </span>
              <Pagination
                current={safePage}
                total={totalPages}
                onChange={setCurrentPage}
                siblingCount={1}
                showFirstLast
              />
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
