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
  '这里还很安静，在左侧选个文件唤醒工作区吧',
  '思绪就绪，挑一份文档或代码，我们即刻开始',
  '空白页是最好的起点，点开一份文件继续写',
  '翻开左侧的文件列表，把未完成的故事接下去',
  '找个文件展开看看，我在这边随时协助你修改',
  '工作区已准备就绪，点击左侧文件开启编辑',
  '把想法装进文件里，从左侧挑一篇开始打磨',
  '哪怕只是改几行字，点开文件就能动手',
  '这里是你的创作画板，选个文件展开看看',
  '在左侧选择文件，我们一边浏览一边完善'
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
