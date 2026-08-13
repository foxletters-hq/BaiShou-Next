import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const WORKBENCH_IDLE_CAPTION_KEYS = [
  'workbench.idle_caption_1',
  'workbench.idle_caption_2',
  'workbench.idle_caption_3',
  'workbench.idle_caption_4',
  'workbench.idle_caption_5',
  'workbench.idle_caption_6',
  'workbench.idle_caption_7',
  'workbench.idle_caption_8',
  'workbench.idle_caption_9',
  'workbench.idle_caption_10'
] as const

export const WORKBENCH_IDLE_CAPTION_FALLBACKS = [
  '打开一个文件，开始我们的创意',
  '从左侧挑一份文件，灵感这就开场',
  '选个文件，我们一起往下写',
  '打开文件，把想法落地到编辑区',
  '点开一份内容，创作从这里启程',
  '找个文件打开，我陪你一起打磨',
  '先打开一个文件，再慢慢展开创意',
  '选中一份文件，开始今天的创作',
  '打开文件，让点子在屏幕上生长',
  '从打开一个文件开始，创意就不会停'
] as const

/** 打开项目后、尚未打开文件时，Latte 下方随机一句引导（i18n） */
export function useWorkbenchIdleCaption(): string {
  const { t } = useTranslation()
  const [index] = useState(
    () => Math.floor(Math.random() * WORKBENCH_IDLE_CAPTION_KEYS.length)
  )
  return useMemo(() => {
    const key = WORKBENCH_IDLE_CAPTION_KEYS[index]!
    const fallback = WORKBENCH_IDLE_CAPTION_FALLBACKS[index]!
    return t(key, fallback)
  }, [index, t])
}
