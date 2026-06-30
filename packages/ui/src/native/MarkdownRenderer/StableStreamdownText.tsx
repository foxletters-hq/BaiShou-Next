import { EnrichedMarkdownText } from 'react-native-enriched-markdown'
import type { StreamdownTextProps } from 'react-native-streamdown'
import { useStableStreamdownMarkdown } from './useStableStreamdownMarkdown'

const STREAMING_MD4C_FLAGS = { latexMath: true, underline: false } as const
const STREAMING_TABLE_HIDDEN = { tableMode: 'hidden' as const }
const STREAMING_TABLE_PROGRESSIVE = { tableMode: 'progressive' as const }

/**
 * 流式 Markdown：稳定 selectable，不在 remend 周期内反复 setState。
 */
export function StableStreamdownText({
  markdown,
  remendConfig,
  selectable = true,
  hideTablesWhileStreaming = false,
  ...enrichedMarkdownProps
}: StreamdownTextProps & { hideTablesWhileStreaming?: boolean }) {
  const processedMarkdown = useStableStreamdownMarkdown(markdown, remendConfig)

  return (
    <EnrichedMarkdownText
      markdown={processedMarkdown}
      streamingAnimation
      selectable={selectable}
      md4cFlags={STREAMING_MD4C_FLAGS}
      streamingConfig={
        hideTablesWhileStreaming ? STREAMING_TABLE_HIDDEN : STREAMING_TABLE_PROGRESSIVE
      }
      {...enrichedMarkdownProps}
    />
  )
}
