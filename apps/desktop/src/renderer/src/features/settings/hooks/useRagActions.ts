export function useRagActions(
  t: any,
  toast: any,
  confirm: any,
  prompt: any,
  alert: any,
  fetchRagInfo: any,
  setIsProcessing: (v: boolean) => void
) {
  const handleAddManualMemory = async () => {
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
  }

  const handleDeleteEntry = async (id: string) => {
    if (!(await confirm(t('common.delete', '删除') + '?', t('common.warning', '警告')))) return
    setIsProcessing(true)
    try {
      await (window as any).api?.rag?.deleteEntry(id)
      await fetchRagInfo()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEditEntry = async (entry: any) => {
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
  }

  const handleExportEmbeddings = async () => {
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
  }

  const handleManageBackups = async () => {
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
          t('settings.rag_backup_actions', '输入序号恢复备份，或输入 "delete:序号" 删除备份：'),
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
  }

  return {
    handleAddManualMemory,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups
  }
}
