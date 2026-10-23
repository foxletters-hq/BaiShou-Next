const TEXT_LAYER_HINT = /无文本层|没有文本层|几乎无文本层|lack a text layer|無文字層|缺文字层/

export function isTextLayerHint(message: string): boolean {
  return TEXT_LAYER_HINT.test(message)
}

export function splitKnowledgeSourceErrorMessage(message?: string | null): {
  error: string | null
  hint: string | null
} {
  const raw = message?.trim() || ''
  if (!raw) return { error: null, hint: null }
  const parts = raw
    .split(/[；;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  const hints = parts.filter((part) => isTextLayerHint(part))
  const errors = parts.filter((part) => !isTextLayerHint(part))
  return {
    error: errors.length > 0 ? errors.join('；') : null,
    hint: hints.length > 0 ? hints.join('；') : null
  }
}
