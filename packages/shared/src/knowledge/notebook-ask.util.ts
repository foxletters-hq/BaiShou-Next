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
