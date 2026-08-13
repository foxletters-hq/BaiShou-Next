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
  '发挥你的创意…',
  '随便写点什么，灵感从这里开始',
  '今天想创造点什么？',
  '把想法丢进来，我们一起打磨',
  '从一句草稿开始就好',
  '有点子？先写下来',
  '来点灵感火花吧',
  '描述你想做的事…',
  '大胆试试，没有标准答案',
  '想到什么就说什么'
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
