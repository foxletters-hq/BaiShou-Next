import { useEffect, useMemo, useRef, useState } from 'react'
import { createWorkletRuntime, scheduleOnRN, scheduleOnRuntime } from 'react-native-worklets'
import remend from 'remend'
import type { RemendOptions } from 'remend'

const defaultRemendConfig: RemendOptions = {
  bold: true,
  italic: true,
  boldItalic: true,
  strikethrough: true,
  links: true,
  linkMode: 'text-only',
  images: true,
  inlineCode: true,
  katex: false,
  setextHeadings: true
}

const remendRuntime = createWorkletRuntime('baishou-remend-processor')

function mergeRemendConfig(config?: RemendOptions): RemendOptions {
  return config ? { ...defaultRemendConfig, ...config } : defaultRemendConfig
}

function processStableRemendInWorklet(
  markdown: string,
  onComplete: (result: string) => void,
  config?: RemendOptions
) {
  const mergedConfig = mergeRemendConfig(config)

  scheduleOnRuntime(remendRuntime, () => {
    'worklet'
    const result = remend(markdown, mergedConfig)
    scheduleOnRN(onComplete, result)
  })
}

export interface UseStableStreamdownMarkdownOptions {
  /** 已落库/非流式：主线程同步 remend，避免首帧空串与原生高度缓存错误 */
  preferSyncRemend?: boolean
}

/**
 * 流式 remend：不在每个 chunk 切换 isStreaming，避免多余重渲染与原生 selectable 抖动。
 */
export function useStableStreamdownMarkdown(
  markdown: string,
  remendConfig?: RemendOptions,
  options: UseStableStreamdownMarkdownOptions = {}
): string {
  const preferSyncRemend = options.preferSyncRemend === true
  const mergedConfig = useMemo(() => mergeRemendConfig(remendConfig), [remendConfig])

  const syncMarkdown = useMemo(() => {
    if (!preferSyncRemend || !markdown) return markdown
    return remend(markdown, mergedConfig)
  }, [preferSyncRemend, markdown, mergedConfig])

  const [processedMarkdown, setProcessedMarkdown] = useState(() =>
    preferSyncRemend ? syncMarkdown : markdown
  )
  const versionRef = useRef(0)
  const remendConfigRef = useRef(remendConfig)
  remendConfigRef.current = remendConfig

  useEffect(() => {
    if (preferSyncRemend) {
      setProcessedMarkdown(syncMarkdown)
      return
    }

    if (markdown === '') {
      setProcessedMarkdown('')
      return
    }

    const currentVersion = ++versionRef.current
    processStableRemendInWorklet(
      markdown,
      (result: string) => {
        if (currentVersion !== versionRef.current) return
        setProcessedMarkdown((prev) => (prev === result ? prev : result))
      },
      remendConfigRef.current
    )
  }, [markdown, preferSyncRemend, syncMarkdown])

  if (preferSyncRemend) {
    return syncMarkdown
  }

  return processedMarkdown
}
