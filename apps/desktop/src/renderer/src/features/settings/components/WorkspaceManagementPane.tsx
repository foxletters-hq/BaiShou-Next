import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MdAdd, MdArrowBack } from 'react-icons/md'
import {
  Input,
  Pagination,
  useDialog,
  useToast,
  validateWorkspaceName,
  type VaultInfo
} from '@baishou/ui'
import './ManagementPane.css'

const PAGE_SIZE = 10

function formatLastAccessed(value: Date | string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    const d = typeof value === 'string' ? new Date(value) : value
    return d.toLocaleString().split('.')[0].replace('T', ' ')
  } catch {
    return fallback
  }
}

function toTimestamp(value: Date | string | undefined): number {
  if (!value) return 0
  try {
    return (typeof value === 'string' ? new Date(value) : value).getTime()
  } catch {
    return 0
  }
}

export const WorkspaceManagementPane: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const toast = useToast()

  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const loadVaults = useCallback(async () => {
    try {
      const vList = await (window as any).api?.vault?.list()
      const active = await (window as any).api?.vault?.getActive()
      if (vList) setVaults(vList)
      setActiveVault(active ?? null)
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }, [])

  useEffect(() => {
    void loadVaults()
  }, [loadVaults])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const sorted = [...vaults].sort(
      (a, b) => toTimestamp(b.lastAccessedAt) - toTimestamp(a.lastAccessedAt)
    )
    if (!q) return sorted
    return sorted.filter((v) => v.name.toLowerCase().includes(q))
  }, [vaults, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredVaults.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedVaults = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredVaults.slice(start, start + PAGE_SIZE)
  }, [filteredVaults, safePage])

  const showPagination = filteredVaults.length > 0

  const handleCreate = async () => {
    const name = await dialog.prompt(t('workspace.new_name', '空间名称'), '')
    if (name === null) return
    const validation = validateWorkspaceName(
      name,
      vaults.map((vault) => vault.name)
    )
    if (!validation.ok) {
      const message =
        validation.reason === 'duplicate'
          ? t('workspace.name_exists', '已经有同名工作空间啦，换一个名字试试。')
          : t('workspace.name_invalid', '工作空间名称不能包含特殊字符，且不能以点号结尾。')
      toast.showWarning(message)
      return
    }
    try {
      await (window as any).api?.vault?.createDialog(validation.name)
      await loadVaults()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('workspace.create_failed', '创建失败'))
    }
  }

  const handleSwitch = async (name: string) => {
    if (activeVault?.name === name) return
    try {
      await (window as any).api?.vault?.switchActive(name)
      await (window as any).api?.vault?.waitForResync?.()
      window.location.reload()
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDelete = async (vaultName: string) => {
    const input = await dialog.prompt(
      t('workspace.delete_confirm_input', '请输入工作区名称 "{{name}}" 以确认删除：', {
        name: vaultName
      })
    )
    if (input === vaultName) {
      try {
        await (window as any).api?.vault?.delete(vaultName)
        await loadVaults()
        toast.showSuccess(t('common.save_success'))
      } catch {
        toast.showError(t('common.errors.save_failed'))
      }
    } else if (input !== null) {
      toast.showError(t('workspace.delete_name_mismatch', '名称不匹配，删除已取消。'))
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
        <h2 className="settings-management-title">{t('workspace.manage', '管理工作空间')}</h2>
        <button
          type="button"
          className="settings-management-header-action"
          onClick={() => void handleCreate()}
        >
          <MdAdd size={18} />
          <span>{t('workspace.create_new', '创建新空间')}</span>
        </button>
      </div>

      <div className="settings-management-scroll">
        <div className="settings-management-card">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('workspace.search_placeholder', '搜索工作空间…')}
          />
        </div>

        {filteredVaults.length === 0 ? (
          <div className="settings-management-card settings-management-empty">
            {t('workspace.search_empty', '没有匹配的工作空间')}
          </div>
        ) : null}

        {pagedVaults.map((vault) => {
          const isActive = activeVault?.name === vault.name
          return (
            <div key={vault.name} className="settings-management-card settings-management-row">
              <div className="settings-management-row-main">
                <span className="settings-management-row-title">{vault.name}</span>
                <span className="settings-management-row-sub">
                  {t('workspace.last_accessed', '上次访问: {{time}}', {
                    time: formatLastAccessed(
                      vault.lastAccessedAt,
                      t('common.unknown_time', '未知时间')
                    )
                  })}
                </span>
              </div>
              <div className="settings-management-row-actions">
                <div className="settings-management-status-slot">
                  {isActive ? (
                    <span className="settings-management-status-current">
                      {t('workspace.current_short', '当前')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="settings-text-btn"
                      onClick={() => void handleSwitch(vault.name)}
                    >
                      {t('workspace.switch', '切换')}
                    </button>
                  )}
                </div>
                {!isActive ? (
                  <button
                    type="button"
                    className="settings-text-btn"
                    style={{ color: '#ef4444' }}
                    onClick={() => void handleDelete(vault.name)}
                  >
                    {t('workspace.delete', '删除')}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}

        {showPagination ? (
          <div className="settings-management-pagination">
            <span className="settings-management-page-info">
              {t('workspace.page_info', '共 {{total}} 个 · 第 {{page}} / {{pages}} 页', {
                total: filteredVaults.length,
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
  )
}
