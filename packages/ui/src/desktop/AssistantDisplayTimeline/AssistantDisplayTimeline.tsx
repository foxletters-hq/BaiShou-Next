import React, { useMemo } from 'react'
import {
  decorateKnowledgeCitedTexts,
  type AssistantDisplayTimelineItem,
  type KnowledgeCitationView
} from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { coalesceTimelineItemsForDisplay } from '../../shared/agent-process'
import { AgentGatePartBubble } from '../AgentGatePartBubble'
import { AgentMarkdownRenderer, AgentThinkSection } from '../AgentMarkdown'
import { AgentProcessSection } from '../AgentProcessSection'
import { AgentToolChainSection } from '../AgentToolChain'

function visibleAnswerText(text: string): string | null {
  const parsed = parseRedactedThinking(text)
  if (parsed.cleanContent) return parsed.cleanContent
  if (!parsed.cleanReasoning) return text
  return null
}

function AssistantDisplayTimelineInner(props: {
  items: AssistantDisplayTimelineItem[]
  isStreaming?: boolean
  isTextStreaming?: boolean
  error?: string | null
  knowledgeCitations?: KnowledgeCitationView[]
  citationAnchorKey?: string
  /** 正文已经写完、模型又没写编号时，在最后一段补上引用锚点 */
  appendCitationMarkers?: boolean
}) {
  const {
    items,
    isStreaming = false,
    isTextStreaming = false,
    error = null,
    knowledgeCitations = [],
    citationAnchorKey = 'turn',
    appendCitationMarkers = false
  } = props
  const activeStreaming = Boolean(isStreaming && !error)
  const coalescedItems = useMemo(() => coalesceTimelineItemsForDisplay(items), [items])

  const citedByKey = useMemo(() => {
    const entries = items.flatMap((item) => {
      if (item.kind !== 'text') return []
      const body = visibleAnswerText(item.text)
      return body ? [{ key: item.key, body }] : []
    })
    const decorated = decorateKnowledgeCitedTexts(
      entries.map((entry) => entry.body),
      knowledgeCitations.length,
      citationAnchorKey,
      { appendWhenMissing: appendCitationMarkers, citations: knowledgeCitations }
    )
    return new Map(entries.map((entry, index) => [entry.key, decorated[index] ?? entry.body]))
  }, [appendCitationMarkers, citationAnchorKey, items, knowledgeCitations])

  return (
    <>
      {coalescedItems.map((coalesced, index) => {
        // 只有时间线最末尾的一项处于生成中；前面的工作过程段、正文和提问卡片都已经结束
        const streamingHere = activeStreaming && index === coalescedItems.length - 1

        if (coalesced.kind === 'process') {
          const reasoningByKey = new Map<string, string>()
          for (const r of coalesced.reasoningItems) {
            reasoningByKey.set(r.key, parseRedactedThinking('', r.text).cleanReasoning || r.text)
          }
          const combinedReasoning = coalesced.reasoningItems
            .map((r) => reasoningByKey.get(r.key) ?? r.text)
            .filter((t) => Boolean(t.trim()))
            .join('\n\n')

          return (
            <AgentProcessSection
              key={coalesced.key}
              reasoningContent={combinedReasoning}
              toolsItems={coalesced.toolsItems}
              isReasoningLoading={streamingHere}
              isReasoningStreaming={streamingHere}
              isStreaming={streamingHere}
              hasAnswerText={coalesced.hasSubsequentText}
              hasPrecedingText={coalesced.hasPrecedingText}
            >
              {coalesced.steps.map((item, stepIdx) => {
                const stepStreamingHere = streamingHere && stepIdx === coalesced.steps.length - 1

                if (item.kind === 'reasoning') {
                  const content =
                    reasoningByKey.get(item.key) ??
                    (parseRedactedThinking('', item.text).cleanReasoning || item.text)
                  if (!content.trim()) return null
                  return (
                    <AgentThinkSection
                      key={item.key}
                      content={content}
                      isStreaming={stepStreamingHere}
                    />
                  )
                }

                if (item.kind === 'gate') {
                  return <AgentGatePartBubble key={item.key} data={item.data} />
                }

                return (
                  <AgentToolChainSection
                    key={item.key}
                    invocations={item.invocations}
                    completedTools={item.completedTools}
                    activeToolName={item.activeToolName}
                    activeToolArgs={item.activeToolArgs}
                    isStreaming={Boolean(streamingHere && item.activeToolName)}
                  />
                )
              })}
            </AgentProcessSection>
          )
        }

        if (coalesced.kind === 'text') {
          const cited = citedByKey.get(coalesced.key) ?? visibleAnswerText(coalesced.text)
          if (!cited) return null
          return (
            <AgentMarkdownRenderer
              key={coalesced.key}
              content={cited}
              isStreaming={isTextStreaming && streamingHere}
            />
          )
        }

        // 伙伴提问：面向用户的交互，按原位置直接展示在正文流中
        return (
          <AgentToolChainSection
            key={coalesced.key}
            invocations={coalesced.invocations}
            completedTools={coalesced.completedTools}
            activeToolName={coalesced.activeToolName}
            activeToolArgs={coalesced.activeToolArgs}
            isStreaming={Boolean(streamingHere && coalesced.activeToolName)}
          />
        )
      })}
    </>
  )
}

export const AssistantDisplayTimeline = React.memo(AssistantDisplayTimelineInner)
