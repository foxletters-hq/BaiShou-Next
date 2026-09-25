import React from 'react'
import type { AssistantDisplayTimelineItem } from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { AgentMarkdownRenderer, AgentThinkSection } from '../AgentMarkdown'
import { AgentToolChainSection } from '../AgentToolChain'

export function AssistantDisplayTimeline(props: {
  items: AssistantDisplayTimelineItem[]
  isStreaming?: boolean
  isTextStreaming?: boolean
  error?: string | null
}) {
  const { items, isStreaming = false, isTextStreaming = false, error = null } = props
  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        if (item.kind === 'reasoning') {
          const parsed = parseRedactedThinking('', item.text)
          const content = parsed.cleanReasoning || item.text
          if (!content.trim()) return null
          return (
            <AgentThinkSection
              key={item.key}
              content={content}
              isStreaming={isStreaming && isLast && !error}
            />
          )
        }
        if (item.kind === 'text') {
          const parsed = parseRedactedThinking(item.text)
          return (
            <React.Fragment key={item.key}>
              {parsed.cleanReasoning ? <AgentThinkSection content={parsed.cleanReasoning} /> : null}
              {parsed.cleanContent ? (
                <AgentMarkdownRenderer
                  content={parsed.cleanContent}
                  isStreaming={isTextStreaming && isLast && !error}
                />
              ) : !parsed.cleanReasoning ? (
                <AgentMarkdownRenderer
                  content={item.text}
                  isStreaming={isTextStreaming && isLast && !error}
                />
              ) : null}
            </React.Fragment>
          )
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
