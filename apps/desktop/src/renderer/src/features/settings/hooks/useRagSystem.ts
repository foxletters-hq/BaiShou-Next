import { useState, useEffect } from 'react'

export function useRagSystem(t: any, toast: any, confirm: any, alert: any, fetchRagInfo: any) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeRagState, setActiveRagState] = useState<any>({
    isRunning: false,
    type: 'idle',
    progress: 0,
    total: 0,
    statusText: ''
  })
  const [hasMismatchModel, setHasMismatchModel] = useState(false)

  useEffect(() => {
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

  const checkMigrationStatus = async () => {
    try {
      const pending = await (window as any).api?.rag?.hasPendingMigration?.()
      const mismatch = await (window as any).api?.rag?.hasModelMismatch?.()
      setHasMismatchModel(!!pending || !!mismatch)
    } catch {}
  }

  const handleDetectDimension = async () => {
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
  }

  const handleClearDimension = async () => {
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
  }

  const handleBatchEmbed = async () => {
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
  }

  const handleTriggerMigration = async () => {
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
  }

  const handleClearAll = async (prompt: any) => {
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
  }

  return {
    isProcessing,
    setIsProcessing,
    activeRagState,
    hasMismatchModel,
    checkMigrationStatus,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handleTriggerMigration,
    handleClearAll
  }
}
