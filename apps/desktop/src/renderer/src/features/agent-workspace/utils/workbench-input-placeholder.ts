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

/** 每次挂载随机选一条工作台输入框 placeholder（i18n） */
export function useWorkbenchInputPlaceholder(): string {
  const { t } = useTranslation()
  const [index] = useState(() =>
    Math.floor(Math.random() * WORKBENCH_INPUT_PLACEHOLDER_KEYS.length)
  )
  return useMemo(() => t(WORKBENCH_INPUT_PLACEHOLDER_KEYS[index]!), [index, t])
}
