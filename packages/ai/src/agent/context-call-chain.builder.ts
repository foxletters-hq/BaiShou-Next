import type { MessageWithParts } from './message.adapter'
import {
  type DisplayContextMessage,
  formatMessageWithPartsForChain,
  formatModelMessagesForDisplay,
  extractCompactionSummary
} from './model-message-display.formatter'
import type { ModelMessage } from 'ai'

export interface BuildCallChainInput {
  systemPrompt?: string
  modelMessages: ModelMessage[]
  target: MessageWithParts
  allMessages: MessageWithParts[]
}

export interface BuildCallChainResult {
  chain: DisplayContextMessage[]
  compressedContent?: string
  systemPrompt: string
}

export class ContextCallChainBuilder {
  static build(input: BuildCallChainInput): BuildCallChainResult {
    const { systemPrompt = '', modelMessages, target, allMessages } = input
    const chain: DisplayContextMessage[] = []

    if (systemPrompt.trim().length > 0) {
      chain.push({
        role: 'system',
        content: systemPrompt,
        label: '系统提示词'
      })
    }

    chain.push(...formatModelMessagesForDisplay(modelMessages))

    let compressedContent: string | undefined

    if (target.role === 'assistant') {
      chain.push(...formatMessageWithPartsForChain(target))
    } else if (target.role === 'user') {
      compressedContent = extractCompactionSummary(target)
      const response = findNextAssistantMessage(allMessages, target.orderIndex)
      if (response) {
        chain.push(...formatMessageWithPartsForChain(response))
      }
    }

    return {
      chain,
      compressedContent,
      systemPrompt
    }
  }
}

function findNextAssistantMessage(
  allMessages: MessageWithParts[],
  afterOrderIndex: number
): MessageWithParts | undefined {
  return allMessages
    .filter((m) => m.role === 'assistant' && m.orderIndex > afterOrderIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0]
}
