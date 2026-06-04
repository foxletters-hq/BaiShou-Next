import { useState, useEffect, useCallback, useRef } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import { SummaryType, logger } from '@baishou/shared'
import { appendVaultDebugLog } from '../services/summary-debug-log.util'

interface Summary {
  id: string
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  content: string
}

interface Stats {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
}

interface MissingSummary {
  type: string
  startDate: string
  endDate: string
  label?: string
  dateRangeStr?: string
}

interface GenerationState {
  progress: number
  phase: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

interface QueueItem {
  id: string
  target: MissingSummary
  progress: number
  phaseIdx: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

export function useSummaryData() {
  const { services, dbReady } = useBaishou()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [stats, setStats] = useState<Stats>({
    totalDiaryCount: 0,
    totalWeeklyCount: 0,
    totalMonthlyCount: 0,
    totalQuarterlyCount: 0,
    totalYearlyCount: 0
  })
  const [missingSummaries, setMissingSummaries] = useState<MissingSummary[]>([])
  const [generationStates, setGenerationStates] = useState<Record<string, GenerationState>>({})
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // 队列状态引用，用于并发控制
  const queueRef = useRef<QueueItem[]>([])
  const activeCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const concurrencyLimitRef = useRef(1)
  const isSchedulingRef = useRef(false)

  // 计算周数
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const diff = date.getTime() - firstDayOfYear.getTime()
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
  }

  // 获取周一
  const getMonday = (date: Date): Date => {
    const day = date.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(date)
    monday.setDate(date.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  // 获取周日
  const getSunday = (monday: Date): Date => {
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return sunday
  }

  // 检测缺失的总结
  const detectMissing = useCallback(
    async (diaryDates: Date[], existingSummaries: Summary[]): Promise<MissingSummary[]> => {
      if (diaryDates.length === 0) return []

      const missing: MissingSummary[] = []
      const now = new Date()

      // 按日期排序
      const sortedDates = [...diaryDates].sort((a, b) => a.getTime() - b.getTime())
      const firstDate = sortedDates[0]!

      // 检测缺失的周总结
      const existingWeeks = new Set<string>()
      existingSummaries
        .filter((s) => s.type === 'weekly')
        .forEach((s) => {
          const start = new Date(s.startDate)
          const key = `${start.getFullYear()}-${getWeekNumber(start)}`
          existingWeeks.add(key)
        })

      // 从第一篇日记的周开始，到当前周之前
      let currentMonday = getMonday(firstDate)
      while (currentMonday < now) {
        const currentSunday = getSunday(currentMonday)
        const weekKey = `${currentMonday.getFullYear()}-${getWeekNumber(currentMonday)}`

        // 检查这一周是否有日记
        const hasDiaryInWeek = sortedDates.some((d) => d >= currentMonday && d <= currentSunday)

        if (hasDiaryInWeek && !existingWeeks.has(weekKey) && currentSunday < now) {
          missing.push({
            type: 'weekly',
            startDate: currentMonday.toISOString(),
            endDate: currentSunday.toISOString(),
            label: `${currentMonday.getFullYear()}年第${getWeekNumber(currentMonday)}周`,
            dateRangeStr: `${currentMonday.toLocaleDateString()} - ${currentSunday.toLocaleDateString()}`
          })
        }

        currentMonday = new Date(currentMonday)
        currentMonday.setDate(currentMonday.getDate() + 7)
      }

      // 检测缺失的月总结
      const existingMonths = new Set<string>()
      existingSummaries
        .filter((s) => s.type === 'monthly')
        .forEach((s) => {
          const start = new Date(s.startDate)
          existingMonths.add(`${start.getFullYear()}-${start.getMonth()}`)
        })

      // 获取所有有日记的月份
      const diaryMonths = new Set<string>()
      sortedDates.forEach((d) => {
        diaryMonths.add(`${d.getFullYear()}-${d.getMonth()}`)
      })

      diaryMonths.forEach((monthKey) => {
        if (!existingMonths.has(monthKey)) {
          const [yearStr, monthStr] = monthKey.split('-')
          const year = parseInt(yearStr!, 10)
          const month = parseInt(monthStr!, 10)
          const monthStart = new Date(year, month, 1)
          const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

          // 只处理当前月之前的月份
          if (monthEnd < now) {
            missing.push({
              type: 'monthly',
              startDate: monthStart.toISOString(),
              endDate: monthEnd.toISOString(),
              label: `${year}年${month + 1}月`,
              dateRangeStr: `${monthStart.toLocaleDateString()} - ${monthEnd.toLocaleDateString()}`
            })
          }
        }
      })

      // 检测缺失的季总结
      const existingQuarters = new Set<string>()
      existingSummaries
        .filter((s) => s.type === 'quarterly')
        .forEach((s) => {
          const start = new Date(s.startDate)
          const quarter = Math.ceil((start.getMonth() + 1) / 3)
          existingQuarters.add(`${start.getFullYear()}-Q${quarter}`)
        })

      const diaryQuarters = new Set<string>()
      sortedDates.forEach((d) => {
        const quarter = Math.ceil((d.getMonth() + 1) / 3)
        diaryQuarters.add(`${d.getFullYear()}-Q${quarter}`)
      })

      diaryQuarters.forEach((quarterKey) => {
        if (!existingQuarters.has(quarterKey)) {
          const [yearStr, qStr] = quarterKey.split('-Q')
          const year = parseInt(yearStr!, 10)
          const quarter = parseInt(qStr!, 10)
          const startMonth = (quarter - 1) * 3
          const quarterStart = new Date(year, startMonth, 1)
          const quarterEnd = new Date(year, startMonth + 3, 0, 23, 59, 59)

          if (quarterEnd < now) {
            missing.push({
              type: 'quarterly',
              startDate: quarterStart.toISOString(),
              endDate: quarterEnd.toISOString(),
              label: `${year}年Q${quarter}`,
              dateRangeStr: `${quarterStart.toLocaleDateString()} - ${quarterEnd.toLocaleDateString()}`
            })
          }
        }
      })

      // 检测缺失的年总结
      const existingYears = new Set<number>()
      existingSummaries
        .filter((s) => s.type === 'yearly')
        .forEach((s) => {
          existingYears.add(new Date(s.startDate).getFullYear())
        })

      const diaryYears = new Set<number>()
      sortedDates.forEach((d) => {
        diaryYears.add(d.getFullYear())
      })

      diaryYears.forEach((year) => {
        if (!existingYears.has(year)) {
          const yearStart = new Date(year, 0, 1)
          const yearEnd = new Date(year, 11, 31, 23, 59, 59)

          if (yearEnd < now) {
            missing.push({
              type: 'yearly',
              startDate: yearStart.toISOString(),
              endDate: yearEnd.toISOString(),
              label: `${year}年度`,
              dateRangeStr: `${yearStart.toLocaleDateString()} - ${yearEnd.toLocaleDateString()}`
            })
          }
        }
      })

      // 按开始日期排序
      missing.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

      return missing
    },
    []
  )

  const fetchData = useCallback(async () => {
    if (!dbReady || !services) return

    try {
      setLoading(true)

      // 获取总结列表
      const summaryList = await services.summaryManager.list()
      const mappedSummaries = summaryList.map((s) => ({
        id: String(s.id),
        type: s.type,
        startDate: s.startDate instanceof Date ? s.startDate.toISOString() : s.startDate,
        endDate: s.endDate instanceof Date ? s.endDate.toISOString() : s.endDate,
        content: s.content
      }))
      setSummaries(mappedSummaries)

      // 获取统计信息
      const diaryCount = await services.diaryService.count()
      const weeklyCount = summaryList.filter((s) => s.type === 'weekly').length
      const monthlyCount = summaryList.filter((s) => s.type === 'monthly').length
      const quarterlyCount = summaryList.filter((s) => s.type === 'quarterly').length
      const yearlyCount = summaryList.filter((s) => s.type === 'yearly').length

      setStats({
        totalDiaryCount: diaryCount,
        totalWeeklyCount: weeklyCount,
        totalMonthlyCount: monthlyCount,
        totalQuarterlyCount: quarterlyCount,
        totalYearlyCount: yearlyCount
      })

      // 检测缺失的总结
      try {
        const allDiaries = await services.diaryService.listAll({
          limit: 10000
        })
        const diaryDates = allDiaries
          .map((d) => (d.date instanceof Date ? d.date : new Date(d.date)))
          .filter((d) => !isNaN(d.getTime()))

        const missing = await detectMissing(diaryDates, mappedSummaries)
        setMissingSummaries(missing)
      } catch (e) {
        console.warn('Detect missing summaries failed:', e)
        setMissingSummaries([])
      }
    } catch (e) {
      console.warn('Failed to fetch summary data', e)
    } finally {
      setLoading(false)
    }
  }, [dbReady, services, detectMissing])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 广播队列状态到 React 状态
  const broadcastState = useCallback(() => {
    const states: Record<string, GenerationState> = {}
    queueRef.current.forEach((item) => {
      states[item.id] = {
        progress: item.progress,
        phase: item.phaseIdx,
        status: item.status,
        error: item.error
      }
    })
    setGenerationStates(states)
  }, [])

  // 处理单个任务（定义在 scheduleNext 之前，避免声明前使用）
  const processTask = useCallback(
    async (task: QueueItem) => {
      const signal = abortControllerRef.current?.signal
      const taskStartTime = Date.now()

      try {
        logger.info(`[SummaryQueue] Starting task: ${task.id}`)
        task.status = 'running'
        task.phaseIdx = 0
        task.progress = 5
        broadcastState()

        // 阶段 0: 发送请求中... 停留一小会儿让用户感知到
        await new Promise((r) => setTimeout(r, 500))
        if (signal?.aborted) throw new Error('用户取消了生成')

        if (!services) throw new Error('Services not ready')

        // 复用 SummaryGeneratorService —— 它内部走 buildMobileSummaryAiClient，
        // Provider/Model 查找逻辑统一且与桌面端一致
        const globalModels = await services.settingsManager.get<any>('global_models')
        const finalModelId = globalModels?.globalSummaryModelId || 'deepseek-chat'

        await appendVaultDebugLog(services.pathService, services.fileSystem, {
          timestamp: new Date().toISOString(),
          event: 'start',
          taskId: task.id,
          targetType: task.target.type,
          modelId: finalModelId
        })

        const target = {
          type: task.target.type as SummaryType,
          startDate: new Date(task.target.startDate),
          endDate: new Date(task.target.endDate),
          label: task.target.label ?? ''
        }
        const stream = services.summaryGenerator.generate(target, finalModelId)

        let finalContent = ''

        for await (const chunk of stream) {
          if (signal?.aborted) {
            task.status = 'error'
            task.error = '用户取消了生成'
            broadcastState()
            break
          }

          if (chunk.includes('STATUS:reading_data')) {
            task.phaseIdx = 1
            task.progress = 25
            broadcastState()
            // 阶段 1: 正在解析源数据... 停留一小会儿让用户有清晰感知
            await new Promise((r) => setTimeout(r, 600))
          } else if (chunk.includes('STATUS:thinking_via_')) {
            logger.info(`[SummaryQueue] Task ${task.id} entered thinking phase: ${chunk}`)
            task.phaseIdx = 2
            task.progress = 50
          } else if (chunk.includes('STATUS:generation_failed_error')) {
            const cleanMsg = chunk.replace('STATUS:generation_failed_error:', '').trim()
            throw new Error(cleanMsg)
          } else if (!chunk.startsWith('STATUS:')) {
            // 阶段 3: AI 总结正流式接收生成... 模拟流式打字机效果输出
            const textLength = chunk.length
            const stepSize = 12 // 每次输出 12 个字
            let currentIdx = 0
            while (currentIdx < textLength) {
              if (signal?.aborted) {
                break
              }
              const nextPart = chunk.substring(currentIdx, currentIdx + stepSize)
              finalContent += nextPart
              currentIdx += stepSize

              task.phaseIdx = 3
              task.progress = 85
              broadcastState()
              await new Promise((r) => setTimeout(r, 30)) // 每隔 30ms 输出一次
            }
          }
          broadcastState()
        }

        if (task.status === 'error') return

        if (finalContent.trim().length > 0) {
          // 正在保存总结... 停留一小会儿让用户感知到
          task.progress = 95
          broadcastState()
          await new Promise((r) => setTimeout(r, 600))

          logger.info(
            `[SummaryQueue] Saving generated summary for task: ${task.id}, content length: ${finalContent.length}`
          )
          await services.summaryManager.save({
            type: task.target.type as SummaryType,
            startDate: new Date(task.target.startDate),
            endDate: new Date(task.target.endDate),
            content: finalContent
          })

          task.status = 'completed'
          task.progress = 100
          task.phaseIdx = 4
          broadcastState()
          logger.info(`[SummaryQueue] Task completed successfully: ${task.id}`)

          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'success',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            contentLength: finalContent.length
          })

          // 刷新数据
          setTimeout(fetchData, 1000)
        } else {
          throw new Error('Generated content was empty.')
        }
      } catch (e: any) {
        logger.error(`[SummaryQueue] Task ${task.id} failed:`, e)
        task.status = 'error'
        task.error = e.message || String(e)
        broadcastState()

        if (services) {
          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'error',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            errorMessage: e?.message || String(e),
            errorStack: e?.stack || ''
          })
        }
      }
    },
    [broadcastState, services, fetchData]
  )

  // 调度下一个任务
  const scheduleNext = useCallback(async () => {
    // 使用标志位防止并发调度
    if (isSchedulingRef.current) return
    isSchedulingRef.current = true

    try {
      while (
        activeCountRef.current < concurrencyLimitRef.current &&
        queueRef.current.some((q) => q.status === 'pending')
      ) {
        const next = queueRef.current.find((q) => q.status === 'pending')
        if (!next) break

        next.status = 'running'
        next.progress = 5
        activeCountRef.current++
        broadcastState()

        // 异步处理任务
        processTask(next).finally(() => {
          activeCountRef.current--
          broadcastState()

          // 继续调度下一个
          if (!abortControllerRef.current?.signal.aborted) {
            scheduleNext()
          }

          // 所有任务完成时清理
          if (activeCountRef.current === 0) {
            abortControllerRef.current = null
            setIsGenerating(false)

            // 延迟清理已完成的任务
            setTimeout(() => {
              const hasFinished = queueRef.current.some(
                (q) => q.status === 'completed' || q.status === 'error'
              )
              if (hasFinished) {
                queueRef.current = queueRef.current.filter(
                  (q) => q.status === 'pending' || q.status === 'running'
                )
                broadcastState()
              }
            }, 3000)
          }
        })
      }
    } finally {
      isSchedulingRef.current = false
    }
  }, [broadcastState, processTask])

  const queueGeneration = async (items: MissingSummary[], concurrency?: number) => {
    if (!dbReady || !services) return

    if (concurrency !== undefined) {
      concurrencyLimitRef.current = Math.max(1, Math.min(5, concurrency))
    }

    let added = 0
    for (const item of items) {
      const uKey = `${item.type}_${new Date(item.startDate).getTime()}`
      if (!queueRef.current.find((q) => q.id === uKey)) {
        queueRef.current.push({
          id: uKey,
          target: item,
          progress: 0,
          phaseIdx: 0,
          status: 'pending'
        })
        added++
      }
    }

    if (added > 0) {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController()
      }
      setIsGenerating(true)
      broadcastState()
      await scheduleNext()
    }
  }

  const stopGeneration = async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    for (const item of queueRef.current) {
      if (item.status === 'running' || item.status === 'pending') {
        item.status = 'error'
        item.error = '用户取消了生成'
      }
    }

    queueRef.current = queueRef.current.filter((q) => q.status !== 'error')
    activeCountRef.current = 0
    setIsGenerating(false)
    broadcastState()
  }

  const generateSummary = async (
    type: string,
    dateRange: { startDate: string; endDate: string }
  ) => {
    if (!dbReady || !services) return

    await queueGeneration([
      {
        type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }
    ])
  }

  const refreshData = () => {
    fetchData()
  }

  const setConcurrency = useCallback((limit: number) => {
    concurrencyLimitRef.current = Math.max(1, Math.min(5, limit))
  }, [])

  return {
    summaries,
    stats,
    missingSummaries,
    setMissingSummaries,
    generateSummary,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    refreshData,
    loading,
    isGenerating
  }
}
