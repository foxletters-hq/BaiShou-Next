import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RagMemoryView, useDialog, useToast } from '@baishou/ui'

export const RagSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [ragStats, setRagStats] = useState<any>({
    totalCount: 0,
    currentDimension: 0,
    totalSizeText: '0 KB'
  })
  const [ragEntries, setRagEntries] = useState<any[]>([])
  const [ragTotalCount, setRagTotalCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeRagState, setActiveRagState] = useState<any>({
    isRunning: false,
    type: 'idle',
    progress: 0,
    total: 0,
    statusText: ''
  })
  const [hasMismatchModel, setHasMismatchModel] = useState(false)
  const { confirm, prompt, alert } = useDialog()
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const stateRef = useRef({ searchQuery, searchMode, currentPage, pageSize })
  useEffect(() => {
    stateRef.current = { searchQuery, searchMode, currentPage, pageSize }
  }, [searchQuery, searchMode, currentPage, pageSize])

  const loadRagData = async (q: string, mode: 'semantic' | 'text', page: number, size: number) => {
    try {
      const s = await (window as any).api?.rag?.getStats()
      if (s) setRagStats(s)

      const limit = size
      const offset = (page - 1) * limit
      const params: any = { limit, offset, mode, withTotal: true }

      if (q && q.trim() !== '') {
        params.keyword = q
        if (mode === 'semantic') {
          params.limit = 50
          params.offset = 0
        }
      }

      const res = await (window as any).api?.rag?.queryEntries(params)
      if (res) {
        if (res.entries && typeof res.total === 'number') {
          const total = res.total
          if (total > 0 && (page - 1) * size >= total) {
            const maxPage = Math.max(1, Math.ceil(total / size))
            setCurrentPage(maxPage)
            loadRagData(q, mode, maxPage, size)
            return
          }
          if (q && q.trim() !== '' && mode === 'semantic') {
            const allEntries = res.entries
            const semanticTotal = res.total
            const sliced = allEntries.slice((page - 1) * size, page * size)
            setRagEntries(sliced)
            setRagTotalCount(semanticTotal)
          } else {
            setRagEntries(res.entries)
            setRagTotalCount(res.total)
          }
        } else {
          // 历史兼容
          setRagEntries(res)
          setRagTotalCount(s ? s.totalCount || 0 : 0)
        }
      }

      try {
        const pending = await (window as any).api?.rag?.hasPendingMigration?.()
        const mismatch = await (window as any).api?.rag?.hasModelMismatch?.()
        setHasMismatchModel(!!pending || !!mismatch)
      } catch {}
    } catch (err) {
      console.error('[SettingsPage] loadRagData failed:', err)
    }
  }

  const fetchRagInfo = async (page?: number, size?: number) => {
    const targetPage = page !== undefined ? page : stateRef.current.currentPage
    const targetSize = size !== undefined ? size : stateRef.current.pageSize
    await loadRagData(
      stateRef.current.searchQuery,
      stateRef.current.searchMode,
      targetPage,
      targetSize
    )
  }

  useEffect(() => {
    loadRagData(searchQuery, searchMode, currentPage, pageSize)
    let cleanup: any
    if ((window as any).api?.rag?.onRagProgress) {
      cleanup = (window as any).api.rag.onRagProgress((state: any) => {
        setActiveRagState(state)
      })
    }
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  if (!settings.ragConfig) return <div />
  return (
    <div className="settings-pane settings-pane-full">
      <RagMemoryView
        config={settings.ragConfig}
        stats={ragStats}
        ragState={
          activeRagState.isRunning
            ? activeRagState
            : { isRunning: isProcessing, type: 'idle', progress: 0, total: 0, statusText: '' }
        }
        hasMismatchModel={hasMismatchModel}
        embeddingModelId={settings.globalModels?.globalEmbeddingModelId}
        entries={ragEntries}
        totalCount={ragTotalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onChange={(config) => settings.setRagConfig(config)}
        onNavigateToConfig={() => navigate('/settings/ai-models')}
        onPageChange={(page, size) => {
          setCurrentPage(page)
          setPageSize(size)
          loadRagData(searchQuery, searchMode, page, size)
        }}
        onDetectDimension={async () => {
          setIsProcessing(true)
          try {
            const detectedDim = await (window as any).api?.rag?.detectDimension()
            await fetchRagInfo()
            if (detectedDim > 0) {
              toast.showSuccess(
                t('settings.rag_detect_success', '检测完成，该模型向量维度为：') + detectedDim
              )
            } else {
              await alert(
                t(
                  'ai_config.error_no_model',
                  '检测失败：可能是未配置有效的 Embedding 模型或服务未连通。'
                ),
                t('common.error', '错误')
              )
            }
          } catch (e: any) {
            await alert(
              t('settings.rag_detect_error', '检测发生错误：') + e.message,
              t('common.error', '错误')
            )
          } finally {
            setIsProcessing(false)
          }
        }}
        onClearDimension={async () => {
          if (
            !(await confirm(
              t('settings.rag_clear_dimension', '清理当前维度数据') + '?',
              t('common.warning', '警告')
            ))
          )
            return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.clearDimension()
            await fetchRagInfo()
          } finally {
            setIsProcessing(false)
          }
        }}
        onBatchEmbed={async () => {
          if (
            !(await confirm(
              t('settings.rag_batch_embed', '全量扫描未索引日记') + '?',
              t('common.warning', '警告')
            ))
          )
            return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.triggerBatchEmbed()
            await fetchRagInfo()
          } finally {
            setIsProcessing(false)
          }
        }}
        onAddManualMemory={async () => {
          const text = await prompt('', '', t('settings.rag_add_manual', '添加手动记忆片段'), true)
          if (!text || text.trim().length === 0) return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.addManualMemory?.(text)
            toast.showSuccess(t('settings.rag_add_manual_success', '记忆片段已添加'))
            await fetchRagInfo()
          } catch (e: any) {
            toast.showError(
              t('settings.rag_add_manual_failed', '添加失败: ') +
                (e?.message || t('common.error', '错误'))
            )
          } finally {
            setIsProcessing(false)
          }
        }}
        onTriggerMigration={async () => {
          if (
            !(await confirm(
              t('settings.rag_trigger_migration', '执行向量库迁移') + '?',
              t('common.warning', '警告')
            ))
          )
            return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.triggerMigration()
            await fetchRagInfo()
          } finally {
            setIsProcessing(false)
          }
        }}
        onClearAll={async () => {
          const phrase = t('settings.rag_clear_all_confirm_phrase', '确认清除')
          const confirmText = await prompt(
            t(
              'settings.rag_clear_all_confirm',
              '请在下方输入「{{phrase}}」以确认清空所有RAG记忆：'
            ).replace('{{phrase}}', phrase),
            '',
            t('settings.rag_clear_all', '清空现有记忆')
          )
          if (confirmText !== phrase) {
            if (confirmText !== null) {
              await alert(
                t('settings.rag_clear_all_mismatch', '输入内容不匹配，操作已取消。'),
                t('common.warning', '警告')
              )
            }
            return
          }
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.clearAll()
            await fetchRagInfo()
          } finally {
            setIsProcessing(false)
          }
        }}
        onSearch={(q, mode) => {
          setSearchQuery(q)
          setSearchMode(mode)
          setCurrentPage(1)
          loadRagData(q, mode, 1, pageSize)
        }}
        onDeleteEntry={async (id) => {
          if (!(await confirm(t('common.delete', '删除') + '?', t('common.warning', '警告'))))
            return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.deleteEntry(id)
            await fetchRagInfo()
          } finally {
            setIsProcessing(false)
          }
        }}
        onEditEntry={async (entry) => {
          const newText = await prompt(
            t('settings.rag_edit_prompt', '请修改下方的记忆片段内容：'),
            entry.text,
            t('settings.rag_edit_manual', '编辑记忆内容'),
            true
          )
          if (!newText || newText === entry.text) return
          setIsProcessing(true)
          try {
            await (window as any).api?.rag?.editEntry({
              embeddingId: entry.embeddingId,
              newText: newText
            })
            await fetchRagInfo()
          } catch (e: any) {
            await alert(e.message, t('common.error', '错误'))
          } finally {
            setIsProcessing(false)
          }
        }}
        onExportEmbeddings={async () => {
          setIsProcessing(true)
          try {
            const data = await (window as any).api?.rag?.exportEmbeddings()
            if (data && data.entries && data.entries.length > 0) {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `rag-export-${new Date().toISOString().slice(0, 10)}.json`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              toast.showSuccess(
                t('settings.rag_export_success', '导出成功') +
                  ` (${data.count} ${t('settings.rag_entries', '条')})`
              )
            } else {
              toast.showWarning(t('settings.rag_export_empty', '没有可导出的数据'))
            }
          } catch (e: any) {
            await alert(
              t('settings.rag_export_error', '导出失败: ') + e.message,
              t('common.error', '错误')
            )
          } finally {
            setIsProcessing(false)
          }
        }}
        onManageBackups={async () => {
          setIsProcessing(true)
          try {
            const backups = await (window as any).api?.rag?.listSafetyBackups()
            if (!backups || backups.length === 0) {
              await alert(t('settings.rag_no_backups', '暂无备份'), t('common.info', '提示'))
              return
            }

            const backupList = backups
              .map(
                (b: any, i: number) =>
                  `${i + 1}. ${b.name} (${b.count} ${t('settings.rag_entries', '条')})`
              )
              .join('\n')

            const choice = await prompt(
              t('settings.rag_backup_list', '可用备份列表：') +
                '\n\n' +
                backupList +
                '\n\n' +
                t(
                  'settings.rag_backup_actions',
                  '输入序号恢复备份，或输入 "delete:序号" 删除备份：'
                ),
              '',
              t('settings.rag_manage_backups', '备份管理'),
              true
            )

            if (!choice) return

            if (choice.startsWith('delete:')) {
              const idx = parseInt(choice.replace('delete:', '')) - 1
              if (idx >= 0 && idx < backups.length) {
                if (
                  !(await confirm(
                    t('settings.rag_confirm_delete_backup', '确认删除此备份?'),
                    t('common.warning', '警告')
                  ))
                )
                  return
                await (window as any).api?.rag?.deleteBackup(backups[idx].name)
                toast.showSuccess(t('settings.rag_backup_deleted', '备份已删除'))
              }
            } else {
              const idx = parseInt(choice) - 1
              if (idx >= 0 && idx < backups.length) {
                if (
                  !(await confirm(
                    t('settings.rag_confirm_restore', '恢复将清空当前记忆并从备份导入，是否继续?'),
                    t('common.warning', '警告')
                  ))
                )
                  return
                setIsProcessing(true)
                const count = await (window as any).api?.rag?.restoreFromBackup(backups[idx].name)
                toast.showSuccess(
                  t('settings.rag_restore_success', '恢复成功') +
                    ` (${count} ${t('settings.rag_entries', '条')})`
                )
                await fetchRagInfo()
              }
            }
          } catch (e: any) {
            await alert(
              t('settings.rag_backup_error', '操作失败: ') + e.message,
              t('common.error', '错误')
            )
          } finally {
            setIsProcessing(false)
          }
        }}
      />
    </div>
  )
}
