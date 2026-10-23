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

/** 打开项目后、尚未打开文件时，Latte 下方随机一句引导（i18n） */
export function useWorkbenchIdleCaption(): string {
  const { t } = useTranslation()
  const [index] = useState(() => Math.floor(Math.random() * WORKBENCH_IDLE_CAPTION_KEYS.length))
  return useMemo(() => t(WORKBENCH_IDLE_CAPTION_KEYS[index]!), [index, t])
}
