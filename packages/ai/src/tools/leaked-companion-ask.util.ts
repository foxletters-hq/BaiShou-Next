import {
  parseCompanionAskStreamArgs,
  type CompanionAskStreamArgs
} from './companion-ask-stream.util'

const INVOKE_BLOCK = /<invoke\s+name=["']companion_ask["'][^>]*>([\s\S]*?)<\/invoke>/i
const PARAMETER_TAG = /<parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/parameter>/gi

function parseParameterValue(raw: string): unknown {
  const value = raw.trim()
  if (!value) return ''
  if (value === 'true') return true
  if (value === 'false') return false
  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function argsFromParameterTags(inner: string): Record<string, unknown> | null {
  const params: Record<string, unknown> = {}
  PARAMETER_TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PARAMETER_TAG.exec(inner)) !== null) {
    const paramName = match[1]
    if (paramName) {
      params[paramName] = parseParameterValue(match[2] ?? '')
    }
  }
  return Object.keys(params).length > 0 ? params : null
}

/** 模型把 companion_ask 写进 XML 正文时，收口后抽出提问参数。 */
export function extractLeakedCompanionAsk(text: string): CompanionAskStreamArgs | null {
  const invoke = INVOKE_BLOCK.exec(text ?? '')
  if (!invoke) return null
  const inner = (invoke[1] ?? '').trim()
  if (!inner) return null
  if (inner.startsWith('{')) {
    return parseCompanionAskStreamArgs(inner)
  }
  const fromTags = argsFromParameterTags(inner)
  if (!fromTags) return null
  try {
    return parseCompanionAskStreamArgs(JSON.stringify(fromTags))
  } catch {
    return null
  }
}
