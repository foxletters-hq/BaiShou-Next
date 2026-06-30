import { useEffect, useRef, useState } from 'react'
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

function processStableRemendInWorklet(
  markdown: string,
  onComplete: (result: string) => void,
  config?: RemendOptions
) {
  const mergedConfig = config ? { ...defaultRemendConfig, ...config } : defaultRemendConfig

  scheduleOnRuntime(remendRuntime, () => {
    'worklet'
    const result = remend(markdown, mergedConfig)
    scheduleOnRN(onComplete, result)
  })
}

/**
 * 流式 remend：不在每个 chunk 切换 isStreaming，避免多余重渲染与原生 selectable 抖动。
 */
export function useStableStreamdownMarkdown(
  markdown: string,
  remendConfig?: RemendOptions
): string {
  const [processedMarkdown, setProcessedMarkdown] = useState('')
  const versionRef = useRef(0)
  const remendConfigRef = useRef(remendConfig)
  remendConfigRef.current = remendConfig

  useEffect(() => {
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
  }, [markdown])

  return processedMarkdown
}
