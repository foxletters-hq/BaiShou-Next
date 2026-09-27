import React from 'react'
import { ContextChainPanel } from '@baishou/ui'
import type { useAgentChatFlow } from './hooks/useAgentChatFlow'

export function AgentContextChainHost({ flow }: { flow: ReturnType<typeof useAgentChatFlow> }) {
  if (!flow.contextDialogState.flatEntries) return null
  return (
    <ContextChainPanel
      key={flow.contextDialogState.message?.id ?? 'context-chain'}
      isOpen={flow.contextDialogState.isOpen}
      onClose={() =>
        flow.setContextDialogState((prev) => ({
          ...prev,
          isOpen: false
        }))
      }
      message={
        flow.contextDialogState.message ?? {
          id: '',
          sessionId: flow.sessionId || '',
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }
      }
      flatEntries={flow.contextDialogState.flatEntries}
      meta={flow.contextDialogState.meta}
      compressedContent={flow.contextDialogState.compressedContent}
      systemPrompt={flow.contextDialogState.systemPrompt}
      sessionId={flow.contextDialogState.sessionId ?? flow.sessionId}
      onCompressionSummaryUpdated={(summaryText) => {
        flow.setContextDialogState((prev) => ({
          ...prev,
          compressedContent: summaryText,
          flatEntries: prev.flatEntries?.map((entry) =>
            entry.kind === 'compression-summary' ? { ...entry, summaryText } : entry
          )
        }))
      }}
      recompressBusy={flow.contextRecompressJob?.status === 'running'}
      recompressStartedAt={
        flow.contextRecompressJob?.status === 'running'
          ? flow.contextRecompressJob.startedAt
          : undefined
      }
      recompressStreamText={
        flow.stream.isCompressing && flow.stream.compressionPhase === 'manual'
          ? flow.stream.compressionText
          : ''
      }
      recompressStreamReasoning={
        flow.stream.isCompressing && flow.stream.compressionPhase === 'manual'
          ? flow.stream.compressionReasoning
          : ''
      }
      recompressError={
        flow.contextRecompressJob?.status === 'error' ? flow.contextRecompressJob.error : null
      }
      onRecompress={() => {
        const sid = flow.contextDialogState.sessionId ?? flow.sessionId
        if (sid) void flow.runContextRecompress(sid)
      }}
      onRecompressDismissError={flow.dismissContextRecompressError}
    />
  )
}
