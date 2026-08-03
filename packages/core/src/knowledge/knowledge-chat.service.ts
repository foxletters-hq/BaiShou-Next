import type { KnowledgeAskResult, KnowledgeCitation } from './knowledge-ask.service'

export interface KnowledgeChatSourceText {
  sourceId: string
  title: string
  text: string
}

export interface KnowledgeChatDeps {
  /** 读取选中资料的提取正文 */
  loadSourceTexts: (notebookId: string, sourceIds: string[]) => Promise<KnowledgeChatSourceText[]>
  generateAnswer: (input: { question: string; contextBlocks: string }) => Promise<string>
}

export interface KnowledgeChatOptions {
  notebookId: string
  question: string
  sourceIds: string[]
  /**
   * 上下文字符预算（粗略 token≈chars/2 中文或 /4 英文）。
   * 默认 24000 字符（约 6k–12k token）。
   */
  maxContextChars?: number
}

const DEFAULT_MAX_CHARS = 24_000
const MIN_CONTEXT_CHARS = 1_000
const MAX_CONTEXT_CHARS = 100_000

export function clampKnowledgeChatContextChars(value?: number): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_MAX_CHARS
  return Math.min(MAX_CONTEXT_CHARS, Math.max(MIN_CONTEXT_CHARS, Math.floor(value)))
}

const SYSTEM = `你是知识库精读助手。用户已手选材料全文放入上下文（非检索）。
只根据提供的材料回答；材料不足时明确说明。可用 [1]、[2] 标注资料编号。`

/**
 * 按预算裁剪材料全文：优先保留靠前资料，单篇过长则截尾。
 */
export function trimSourcesToBudget(
  sources: KnowledgeChatSourceText[],
  maxChars: number
): { blocks: string; truncated: boolean; usedChars: number } {
  const parts: string[] = []
  let used = 0
  let truncated = false
  const overheadPer = 40

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!
    const header = `[${i + 1}] ${s.title}\n`
    const remain = maxChars - used - header.length - overheadPer
    if (remain <= 0) {
      truncated = true
      break
    }
    let body = s.text
    if (body.length > remain) {
      body = `${body.slice(0, Math.max(0, remain - 1))}…`
      truncated = true
    }
    parts.push(`${header}${body}`)
    used += header.length + body.length + 2
    if (truncated && body.endsWith('…')) {
      // 本篇已截断，后续不再塞
      if (i < sources.length - 1) truncated = true
      break
    }
  }

  return { blocks: parts.join('\n\n'), truncated, usedChars: used }
}

/**
 * Chat 精读档位：用户手选材料全文进上下文（不检索）+ 简单 token/字符预算裁剪。
 */
export class KnowledgeChatService {
  constructor(private readonly deps: KnowledgeChatDeps) {}

  async chat(
    opts: KnowledgeChatOptions
  ): Promise<KnowledgeAskResult & { truncated: boolean; mode: 'chat' }> {
    const notebookId = opts.notebookId?.trim()
    if (!notebookId) throw new Error('knowledge chat requires notebookId')
    const question = opts.question?.trim()
    if (!question) throw new Error('knowledge chat requires question')
    if (!opts.sourceIds?.length) throw new Error('knowledge chat requires sourceIds')

    const sources = await this.deps.loadSourceTexts(notebookId, opts.sourceIds)
    if (!sources.length) {
      return {
        answer: '未读到所选资料的正文，请确认资料已提取完成。',
        citations: [],
        hits: [],
        truncated: false,
        mode: 'chat'
      }
    }

    const maxChars = clampKnowledgeChatContextChars(opts.maxContextChars)
    const { blocks, truncated } = trimSourcesToBudget(sources, maxChars)

    const answer = await this.deps.generateAnswer({
      question,
      contextBlocks: blocks
    })

    const citations: KnowledgeCitation[] = sources.map((s, i) => ({
      sourceId: s.sourceId,
      title: s.title,
      chunkId: `chat_${s.sourceId}`,
      chunkIndex: i,
      excerpt: s.text.replace(/\s+/g, ' ').trim().slice(0, 240),
      score: 1,
      source: 'vector' as const
    }))

    return { answer, citations, hits: [], truncated, mode: 'chat' }
  }

  static buildPrompt(question: string, contextBlocks: string): { system: string; prompt: string } {
    return {
      system: SYSTEM,
      prompt: `精读材料：\n${contextBlocks || '（无）'}\n\n问题：${question}\n\n请作答：`
    }
  }
}
