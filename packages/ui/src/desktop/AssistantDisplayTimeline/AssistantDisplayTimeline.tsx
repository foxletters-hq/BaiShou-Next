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

function restIsOnlyGates(items: readonly { kind: string }[], index: number): boolean {
  return items.slice(index + 1).every((item) => item.kind === 'gate')
}

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
        const streamingHere = restIsOnlyGates(coalescedItems, index) && !error

        if (coalesced.kind === 'process') {
          const reasoningByKey = new Map<string, string>()
          for (const r of coalesced.reasoningItems) {
            reasoningByKey.set(r.key, parseRedactedThinking('', r.text).cleanReasoning || r.text)
          }
          const cleanReasonings = [
            ...coalesced.reasoningItems.map((r) => reasoningByKey.get(r.key) ?? r.text),
            ...coalesced.textItems.map((t) => t.text)
          ].filter((t) => Boolean(t.trim()))
          const combinedReasoning = cleanReasonings.join('\n\n')
          const processStreaming = !coalesced.hasSubsequentText && Boolean(isStreaming && !error)

          return (
            <AgentProcessSection
              key={coalesced.key}
              reasoningContent={combinedReasoning}
              toolsItems={coalesced.toolsItems}
              isReasoningLoading={processStreaming}
              isReasoningStreaming={processStreaming}
              isStreaming={Boolean(isStreaming && !error)}
              hasAnswerText={coalesced.hasSubsequentText}
              hasPrecedingText={coalesced.hasPrecedingText}
            >
              {coalesced.steps.map((item, stepIdx) => {
                const isLastStep = stepIdx === coalesced.steps.length - 1
                const stepStreamingHere = processStreaming && isLastStep && streamingHere

                if (item.kind === 'reasoning') {
                  const content =
                    reasoningByKey.get(item.key) ??
                    (parseRedactedThinking('', item.text).cleanReasoning || item.text)
                  if (!content.trim()) return null
                  return (
                    <AgentThinkSection
                      key={item.key}
                      content={content}
                      isStreaming={isStreaming && stepStreamingHere}
                    />
                  )
                }

                if (item.kind === 'text') {
                  const cited = citedByKey.get(item.key) ?? visibleAnswerText(item.text)
                  if (!cited?.trim()) return null
                  return (
                    <AgentThinkSection
                      key={item.key}
                      content={cited}
                      isStreaming={isTextStreaming && stepStreamingHere}
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
                    isStreaming={Boolean(isStreaming && item.activeToolName && !error)}
                  />
                )
              })}
            </AgentProcessSection>
          )
        }

        if (coalesced.kind === 'text') {
          const item = coalesced
          const cited = citedByKey.get(item.key) ?? visibleAnswerText(item.text)
          if (!cited) return null
          return (
            <AgentMarkdownRenderer
              key={item.key}
              content={cited}
              isStreaming={isTextStreaming && streamingHere}
            />
          )
        }

        if (coalesced.kind === 'gate') {
          const item = coalesced
          return <AgentGatePartBubble key={item.key} data={item.data} />
        }

        return null
      })}
    </>
  )
}

export const AssistantDisplayTimeline = React.memo(AssistantDisplayTimelineInner)
