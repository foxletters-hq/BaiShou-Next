import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const WORKBENCH_INPUT_PLACEHOLDER_KEYS = [
  'workbench.input_placeholder_1',
  'workbench.input_placeholder_2',
  'workbench.input_placeholder_3',
  'workbench.input_placeholder_4',
  'workbench.input_placeholder_5',
  'workbench.input_placeholder_6',
  'workbench.input_placeholder_7',
  'workbench.input_placeholder_8',
  'workbench.input_placeholder_9',
  'workbench.input_placeholder_10'
] as const

export const WORKBENCH_INPUT_PLACEHOLDER_FALLBACKS = [
  '写下一行代码、一段文字，或一个模糊的念头…',
  '输入任务、粘贴材料，或直接描述你的修改要求…',
  '哪怕只是丢下一句草稿，我也能帮你理顺…',
  '想做新功能、修补问题，还是整理文档？告诉我即可…',
  '把需求说清楚，剩下的脏活累活交给我…',
  '说说你现在的想法，我们一起推导出具体方案…',
  '粘贴一段待处理的内容，我帮你梳理提炼…',
  '随时告诉我下一步要做什么…',
  '描述你期望的效果，我来提供修改建议…',
  '直接输入你想对工作区执行的操作…'
] as const

/** 每次挂载随机选一条工作台输入框 placeholder（i18n） */
export function useWorkbenchInputPlaceholder(): string {
  const { t } = useTranslation()
  const [index] = useState(
    () => Math.floor(Math.random() * WORKBENCH_INPUT_PLACEHOLDER_KEYS.length)
  )
  return useMemo(() => {
    const key = WORKBENCH_INPUT_PLACEHOLDER_KEYS[index]!
    const fallback = WORKBENCH_INPUT_PLACEHOLDER_FALLBACKS[index]!
    return t(key, fallback)
  }, [index, t])
}
