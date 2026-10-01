import React, { useMemo } from 'react'
import { View } from 'react-native'
import {
  decorateKnowledgeCitedTexts,
  type AssistantDisplayTimelineItem,
  type KnowledgeCitationView
} from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { AgentGatePartCard } from '../AgentGatePartCard'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { AgentThinkSection } from '../AgentThinkSection'
import { AgentToolChainSection } from '../AgentToolChain'
import { useNativeTheme } from '../theme'

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
  isThinkStreaming?: boolean
  isTextStreaming?: boolean
  error?: string | null
  knowledgeCitations?: KnowledgeCitationView[]
  citationAnchorKey?: string
  appendCitationMarkers?: boolean
  onImagePress?: (src: string, resolvedUri: string) => void
}) {
  const {
    items,
    isStreaming = false,
    isThinkStreaming = false,
    isTextStreaming = false,
    error = null,
    knowledgeCitations = [],
    citationAnchorKey = 'turn',
    appendCitationMarkers = false,
    onImagePress
  } = props
  const { tokens } = useNativeTheme()
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
    <View style={{ gap: tokens.spacing.sm, alignSelf: 'stretch', width: '100%' }}>
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
              isLoading={isStreaming && streamingHere}
              isMarkdownStreaming={isThinkStreaming && streamingHere}
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
                <View style={{ alignSelf: 'stretch', width: '100%' }}>
                  <AgentMarkdownRenderer
                    content={cited}
                    isStreaming={isTextStreaming && streamingHere}
                    variant="chat"
                    onImagePress={onImagePress}
                  />
                </View>
              ) : null}
            </React.Fragment>
          )
        }
        if (item.kind === 'gate') {
          return <AgentGatePartCard key={item.key} data={item.data} />
        }
        return (
          <AgentToolChainSection
            key={item.key}
            invocations={item.invocations}
            completedTools={item.completedTools}
            activeToolName={item.activeToolName}
            activeToolArgs={item.activeToolArgs}
            isStreaming={Boolean(isStreaming && item.activeToolName && !error)}
            defaultExpanded={Boolean(isStreaming && item.activeToolName)}
          />
        )
      })}
    </View>
  )
}
