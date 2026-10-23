import { useMemo } from 'react'
import {
  assistantStreamTimelineSignature,
  buildAssistantDisplayTimelineFromParts,
  groupStreamTimelineForDisplay,
  type AgentGatePartData,
  type AgentStreamTimelineItem,
  type AssistantDisplayTimelineItem
} from '@baishou/shared'
import type { ChatBubbleMessage } from './chat-bubble.types'

/** 流式覆盖时只用 live 时间线，避免重生成开头把上一轮落库片段闪回来。
 *  覆盖刚结束而落库 parts 还没到时，继续用 live，避免正文先卸掉闪白。 */
export function resolveNativeAssistantTimelineItems(
  preferLive: boolean,
  liveItems: AssistantDisplayTimelineItem[],
  persistedItems: AssistantDisplayTimelineItem[]
): AssistantDisplayTimelineItem[] {
  if (preferLive) return liveItems
  if (persistedItems.length === 0 && liveItems.length > 0) return liveItems
  return persistedItems
}

export function useNativeAssistantTimeline(options: {
  liveTimeline: AgentStreamTimelineItem[]
  gateParts: AgentGatePartData[]
  parts: ChatBubbleMessage['parts']
  preferLive: boolean
}) {
  const { liveTimeline, gateParts, parts, preferLive } = options
  const timelineKey = assistantStreamTimelineSignature(liveTimeline)
  const liveItems = useMemo(
    () => groupStreamTimelineForDisplay(liveTimeline, gateParts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timelineKey 已覆盖内容
    [gateParts, timelineKey]
  )
  const persistedItems = useMemo(
    () => buildAssistantDisplayTimelineFromParts(parts, { gateSurface: 'companion' }),
    [parts]
  )
  const items = resolveNativeAssistantTimelineItems(preferLive, liveItems, persistedItems)
  return { items, useTimeline: items.length > 0 }
}
