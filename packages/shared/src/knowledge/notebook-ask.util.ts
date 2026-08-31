export function isGarbledExtractText(text: string): boolean {
  const sample = text.replace(/\s+/g, ' ').trim().slice(0, 480)
  if (!sample) return false
  const replacement = (sample.match(/\uFFFD/g) || []).length
  if (replacement / sample.length >= 0.02) return true

  const cjkChars = sample.match(/[\u4e00-\u9fff]/g) || []
  const cjkRuns = sample.match(/[\u4e00-\u9fff]{2,}/g) || []
  const cjkInRuns = cjkRuns.join('').length
  if (cjkChars.length >= 16 && (cjkChars.length - cjkInRuns) / cjkChars.length >= 0.55) {
    return true
  }

  const tokens = sample.split(/[\s,，。；;:：、|\\/]+/).filter(Boolean)
  if (tokens.length >= 10) {
    const junk = tokens.filter((token) => token.length <= 2).length
    if (junk / tokens.length >= 0.62) return true
  }
  return false
}

export function shouldRetrieveNotebookSources(question: string): boolean {
  const q = question.replace(/\s+/g, ' ').trim()
  if (!q) return false
  if (/[?？]/.test(q)) return true
  if (
    /(什么|为什么|怎么|如何|哪|谁|总结|概括|对比|解释|列举|根据|资料|这[本篇]|来源|结论|分歧|讲了|讲的)/.test(
      q
    )
  ) {
    return true
  }
  if (
    /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|hmm+|嗯+|好的?|谢谢|你好|嗨+|在吗|早上好|晚安)[!！.。~]*$/i.test(
      q
    )
  ) {
    return false
  }
  return q.length >= 12
}

export function citedReferenceIndexes(answer: string): Set<number> {
  const used = new Set<number>()
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const index = Number(match[1])
    if (Number.isInteger(index) && index >= 1) used.add(index)
  }
  return used
}

export function selectCitedReferences<T>(answer: string, citations: T[]): T[] {
  const used = citedReferenceIndexes(answer)
  if (used.size === 0) return []
  return citations.filter((_, index) => used.has(index + 1))
}

export function pickNotebookChatCitations<T extends { excerpt?: string }>(
  answer: string,
  citations: T[] | undefined
): Array<T & { displayIndex: number }> {
  if (!citations?.length) return []
  const used = citedReferenceIndexes(answer)
  if (used.size === 0) return []
  return citations
    .map((row, index) => ({ ...row, displayIndex: index + 1 }))
    .filter((row) => used.has(row.displayIndex) && !isGarbledExtractText(row.excerpt || ''))
}
