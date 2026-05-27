export const formatTokens = (tokens: number): string => {
  if (tokens >= 10000) {
    const w = tokens / 10000
    return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`
  }
  return String(tokens)
}
