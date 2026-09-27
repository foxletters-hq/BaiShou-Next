import React, { useMemo } from 'react'
import {
  decorateKnowledgeCitedTexts,
  type AssistantDisplayTimelineItem,
  type KnowledgeCitationView
} from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { AgentGatePartBubble } from '../AgentGatePartBubble'
import { AgentMarkdownRenderer, AgentThinkSection } from '../AgentMarkdown'
import { AgentToolChainSection } from '../AgentToolChain'

function restIsOnlyGates(items: readonly AssistantDisplayTimelineItem[], index: number): boolean {
  return items.slice(index + 1).every((item) => item.kind === 'gate')
}

function visibleAnswerText(text: string): string | null {
  const parsed = parseRedactedThinking(text)
  if (parsed.cleanContent) return parsed.cleanContent
  if (!parsed.cleanReasoning) return text
  return null
}

export function AssistantDisplayTimeline(props: {
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
      {items.map((item, index) => {
        const streamingHere = restIsOnlyGates(items, index) && !error
        if (item.kind === 'reasoning') {
          const parsed = parseRedactedThinking('', item.text)
          const content = parsed.cleanReasoning || item.text
          if (!content.trim()) return null
          return (
            <AgentThinkSection
              key={item.key}
              content={content}
              isStreaming={isStreaming && streamingHere}
            />
          )
        }
        if (item.kind === 'text') {
          const parsed = parseRedactedThinking(item.text)
          const cited = citedByKey.get(item.key)
          return (
            <React.Fragment key={item.key}>
              {parsed.cleanReasoning ? <AgentThinkSection content={parsed.cleanReasoning} /> : null}
              {cited ? (
                <AgentMarkdownRenderer
                  content={cited}
                  isStreaming={isTextStreaming && streamingHere}
                />
              ) : null}
            </React.Fragment>
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
    </>
  )
}
