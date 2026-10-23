export type KnowledgeCitationView = {
  notebookId?: string
  notebookName: string
  title: string
  excerpt?: string
  page?: number
  offset?: number
  chunkIndex?: number
  sourceId?: string
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeCitation(raw: unknown): KnowledgeCitationView | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const title = readOptionalString(row.title)
  if (!title) return null
  const notebookName =
    readOptionalString(row.notebookName) || readOptionalString(row.notebookId) || ''
  return {
    notebookId: readOptionalString(row.notebookId),
    notebookName,
    title,
    excerpt: readOptionalString(row.excerpt),
    page: readOptionalNumber(row.page),
    offset: readOptionalNumber(row.offset),
    chunkIndex: readOptionalNumber(row.chunkIndex),
    sourceId: readOptionalString(row.sourceId)
  }
}

export function parseKnowledgeSearchToolResult(result: unknown): {
  text: string
  citations: KnowledgeCitationView[]
} | null {
  const raw = typeof result === 'string' ? tryParseJson(result) : result
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.text !== 'string' || !Array.isArray(obj.citations)) return null
  return {
    text: obj.text,
    citations: obj.citations
      .map(normalizeCitation)
      .filter((row): row is KnowledgeCitationView => row != null)
  }
}

export function collectKnowledgeCitationsFromInvocations(
  invocations: Array<{ toolName?: string; result?: unknown }> | undefined
): KnowledgeCitationView[] {
  if (!invocations?.length) return []
  const out: KnowledgeCitationView[] = []
  for (const invocation of invocations) {
    if (invocation.toolName !== 'knowledge_search') continue
    const parsed = parseKnowledgeSearchToolResult(invocation.result)
    if (parsed) out.push(...parsed.citations)
  }
  return out
}

export function formatKnowledgeCitationLocation(citation: KnowledgeCitationView): string {
  if (citation.page != null) return `第 ${citation.page} 页`
  if (citation.offset != null) return `偏移 ${citation.offset}`
  if (citation.chunkIndex != null) return `片段 #${citation.chunkIndex}`
  return ''
}

export function formatKnowledgeCitationHeading(
  citation: KnowledgeCitationView,
  index: number
): string {
  const notebook = citation.notebookName.trim()
  const location = formatKnowledgeCitationLocation(citation)
  const source = `${notebook ? `${notebook} · ` : ''}${citation.title}${
    location ? `（${location}）` : ''
  }`
  return `「${index}」 ${source}`.trim()
}

export function knowledgeCitationAnchorKey(anchorKey: string): string {
  return anchorKey.replace(/[^A-Za-z0-9_-]/g, '') || 'turn'
}

/** 同一条回答里的引用锚点。锚点带上消息 id，避免多条气泡的 [1] 撞到同一个节点。 */
export function knowledgeCitationDomId(anchorKey: string, index: number): string {
  return `kb-cite-${knowledgeCitationAnchorKey(anchorKey)}-${index}`
}

export function parseKnowledgeCitationHref(
  href: string
): { anchorKey: string; index: number } | null {
  const match = /^(?:#)?kb-cite-(.+)-(\d+)$/.exec(href.trim())
  if (!match) return null
  const index = Number(match[2])
  if (!Number.isInteger(index) || index < 1) return null
  return { anchorKey: match[1]!, index }
}

function inlineCitationMarker(): RegExp {
  return /\[(\d{1,2})\](?!\()/g
}

export function contentHasKnowledgeCitationMarkers(
  content: string,
  citationCount: number
): boolean {
  if (!content || citationCount <= 0) return false
  for (const match of content.matchAll(inlineCitationMarker())) {
    const index = Number(match[1])
    if (index >= 1 && index <= citationCount) return true
  }
  return false
}

function citationMark(index: number, anchorKey: string, hint?: string): string {
  const id = knowledgeCitationDomId(anchorKey, index)
  const title = hint
    ?.replace(/[[\]"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) return `[「${index}」](#${id})`
  return `[「${index}」](#${id} "${title.slice(0, 80)}")`
}

function linkCitationMarkers(segment: string, citationCount: number, anchorKey: string): string {
  return segment.replace(inlineCitationMarker(), (match, raw: string) => {
    const index = Number(raw)
    if (!Number.isInteger(index) || index < 1 || index > citationCount) return match
    return citationMark(index, anchorKey)
  })
}

/** 把正文里的 [1] 收成可点的引用锚点。代码块里的编号保持原样。 */
export function applyInlineKnowledgeCitations(
  content: string,
  citationCount: number,
  anchorKey: string
): string {
  if (!content || citationCount <= 0) return content
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((part, index) =>
      index % 2 === 1 ? part : linkCitationMarkers(part, citationCount, anchorKey)
    )
    .join('')
}

export type KnowledgeCitationMarkSource = {
  excerpt?: string
  title?: string
  notebookName?: string
}

function normalizeCitationCompareText(text: string): string {
  return text.replace(/\s+/g, '').replace(/[“”"'「」《》()（）【】[\]，,、；;：:。！？!?]/g, '')
}

function gramHits(sentence: string, excerpt: string, size: number): number {
  const left = normalizeCitationCompareText(sentence)
  const right = normalizeCitationCompareText(excerpt).slice(0, 200)
  if (!left || !right) return 0
  if (right.length < size) return left.includes(right) ? size : 0
  const seen = new Set<string>()
  let hits = 0
  for (let i = 0; i <= right.length - size; i += 1) {
    const gram = right.slice(i, i + size)
    if (seen.has(gram)) continue
    seen.add(gram)
    if (left.includes(gram)) hits += 1
  }
  return hits
}

/** 句子和摘录有足够长的重合时，才把编号标在这句后面。 */
function citationSentenceScore(sentence: string, excerpt: string): number {
  const hits6 = gramHits(sentence, excerpt, 6)
  if (hits6 >= 2) return 100 + hits6
  const hits4 = gramHits(sentence, excerpt, 4)
  if (hits4 >= 4) return hits4
  return 0
}

function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let buffer = ''
  for (const char of text) {
    buffer += char
    if ('。！？!?\n'.includes(char)) {
      sentences.push(buffer)
      buffer = ''
    }
  }
  if (buffer) sentences.push(buffer)
  return sentences
}

type CitationTextPiece =
  | { kind: 'code'; text: string; textIndex: number }
  | { kind: 'sentence'; text: string; textIndex: number }

function citationPieces(text: string, textIndex: number): CitationTextPiece[] {
  const chunks = text.split(/(```[\s\S]*?```)/g)
  const pieces: CitationTextPiece[] = []
  chunks.forEach((chunk, index) => {
    if (!chunk) return
    if (index % 2 === 1) {
      pieces.push({ kind: 'code', text: chunk, textIndex })
      return
    }
    for (const sentence of splitSentences(chunk)) {
      pieces.push({ kind: 'sentence', text: sentence, textIndex })
    }
  })
  return pieces
}

function citationHint(source: KnowledgeCitationMarkSource | undefined): string | undefined {
  if (!source) return undefined
  const notebook = source.notebookName?.trim()
  const title = source.title?.trim()
  const hint = [notebook, title].filter(Boolean).join(' · ')
  return hint || undefined
}

/**
 * 模型经常不写 [1]。按摘录把编号放到用到这段资料的句子后面，读者才知道哪一句有出处。
 * 对不上任何句子的编号仍留在正文末尾。代码块里不插入。
 */
export function placeInlineKnowledgeCitations(
  texts: string[],
  citations: KnowledgeCitationMarkSource[],
  anchorKey: string
): string[] {
  if (citations.length === 0 || texts.length === 0) return texts
  const pieces = texts.flatMap((text, textIndex) => citationPieces(text, textIndex))
  const marksByPiece = new Map<number, number[]>()
  const unmatched: number[] = []
  citations.forEach((citation, offset) => {
    const number = offset + 1
    const excerpt = citation.excerpt?.trim() ?? ''
    let bestIndex = -1
    let bestScore = 0
    if (excerpt) {
      pieces.forEach((piece, index) => {
        if (piece.kind !== 'sentence') return
        const score = citationSentenceScore(piece.text, excerpt)
        if (score > bestScore) {
          bestScore = score
          bestIndex = index
        }
      })
    }
    if (bestIndex >= 0) {
      const list = marksByPiece.get(bestIndex) ?? []
      list.push(number)
      marksByPiece.set(bestIndex, list)
      return
    }
    unmatched.push(number)
  })

  const out = texts.map(() => '')
  pieces.forEach((piece, index) => {
    const marks = (marksByPiece.get(index) ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((number) => citationMark(number, anchorKey, citationHint(citations[number - 1])))
      .join('')
    out[piece.textIndex] += piece.kind === 'sentence' ? `${piece.text}${marks}` : piece.text
  })

  if (unmatched.length > 0) {
    const lastIndex = Math.max(0, out.length - 1)
    const tail = unmatched
      .map((number) => citationMark(number, anchorKey, citationHint(citations[number - 1])))
      .join('')
    const last = out[lastIndex] ?? ''
    out[lastIndex] = last.trim() ? `${last.trimEnd()}\n\n${tail}` : tail
  }
  return out
}

function stripInlineKnowledgeCitationMarkers(content: string, citationCount: number): string {
  if (!content || citationCount <= 0) return content
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part
      return part.replace(/\s*\[(\d{1,2})\](?!\()/g, (match, raw: string) => {
        const number = Number(raw)
        if (!Number.isInteger(number) || number < 1 || number > citationCount) return match
        return ''
      })
    })
    .join('')
}

/**
 * 模型没把编号写进正文时，把引用标进对应句子。
 * 模型把整段都标成 [1] 时，也按摘录重合重标，避免点击打开无关片段。
 * 流式输出中不要补，避免编号贴在半句后面来回跳。
 */
export function decorateKnowledgeCitedTexts(
  texts: string[],
  citationCount: number,
  anchorKey: string,
  options?: { appendWhenMissing?: boolean; citations?: KnowledgeCitationMarkSource[] }
): string[] {
  if (citationCount <= 0) return texts
  const sources = (options?.citations ?? []).slice(0, citationCount)
  const hasExcerpts = sources.some((source) => Boolean(source.excerpt?.trim()))
  if (options?.appendWhenMissing && hasExcerpts) {
    return placeInlineKnowledgeCitations(
      texts.map((text) => stripInlineKnowledgeCitationMarkers(text, citationCount)),
      sources,
      anchorKey
    )
  }
  const linked = texts.map((text) => applyInlineKnowledgeCitations(text, citationCount, anchorKey))
  if (!options?.appendWhenMissing) return linked
  if (texts.some((text) => contentHasKnowledgeCitationMarkers(text, citationCount))) return linked
  const lastIndex = linked.length - 1
  if (lastIndex < 0) return linked
  const marks = Array.from({ length: citationCount }, (_, offset) =>
    citationMark(offset + 1, anchorKey)
  ).join('')
  const next = [...linked]
  const last = next[lastIndex] ?? ''
  next[lastIndex] = last.trim() ? `${last.trimEnd()}\n\n${marks}` : marks
  return next
}
