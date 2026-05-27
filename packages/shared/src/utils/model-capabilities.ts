function getLowerBaseModelName(id: string): string {
  if (!id) return ''
  const normalizedId = id.toLowerCase().startsWith('accounts/fireworks/models/')
    ? id.replace(/(\d)p(?=\d)/g, '$1.')
    : id

  const parts = normalizedId.split('/')
  let baseModelName = (parts[parts.length - 1] || '').toLowerCase()

  if (baseModelName.endsWith(':free')) {
    baseModelName = baseModelName.replace(':free', '')
  }
  if (baseModelName.endsWith('(free)')) {
    baseModelName = baseModelName.replace('(free)', '')
  }
  if (baseModelName.endsWith(':cloud')) {
    baseModelName = baseModelName.replace(':cloud', '')
  }
  return baseModelName
}

const visionAllowedModels = [
  'llava',
  'moondream',
  'minicpm',
  'gemini-1\\.5',
  'gemini-2\\.0',
  'gemini-2\\.5',
  'gemini-3(?:\\.\\d)?-(?:flash|pro)(?:-preview)?',
  'gemini-(flash|pro|flash-lite)-latest',
  'gemini-exp',
  'claude-3',
  'claude-haiku-4',
  'claude-sonnet-4',
  'claude-opus-4',
  'vision',
  'glm-4(?:\\.\\d+)?v(?:-[\\w-]+)?',
  'qwen-vl',
  'qwen2-vl',
  'qwen2.5-vl',
  'qwen3-vl',
  'qwen3\\.[5-9](?:-[\\w-]+)?',
  'qwen2.5-omni',
  'qwen3-omni(?:-[\\w-]+)?',
  'qvq',
  'internvl2',
  'grok-vision-beta',
  'grok-4(?:-[\\w-]+)?',
  'pixtral',
  'gpt-4(?:-[\\w-]+)',
  'gpt-4.1(?:-[\\w-]+)?',
  'gpt-4o(?:-[\\w-]+)?',
  'gpt-4.5(?:-[\\w-]+)',
  'gpt-5(?:-[\\w-]+)?',
  'chatgpt-4o(?:-[\\w-]+)?',
  'o1(?:-[\\w-]+)?',
  'o3(?:-[\\w-]+)?',
  'o4(?:-[\\w-]+)?',
  'deepseek-vl(?:[\\w-]+)?',
  'kimi-k2\\.[56](?:-[\\w-]+)?',
  'kimi-latest',
  'gemma-?[3-4](?:[-.\\w]+)?',
  'doubao-seed-1[.-][68](?:-[\\w-]+)?',
  'doubao-seed-2[.-]0(?:-[\\w-]+)?',
  'doubao-seed-code(?:-[\\w-]+)?',
  'kimi-thinking-preview',
  `gemma3(?:[-:\\w]+)?`,
  'kimi-vl-a3b-thinking(?:-[\\w-]+)?',
  'llama-guard-4(?:-[\\w-]+)?',
  'llama-4(?:-[\\w-]+)?',
  'step-1o(?:.*vision)?',
  'step-1v(?:-[\\w-]+)?',
  'qwen-omni(?:-[\\w-]+)?',
  'mistral-large-(2512|latest)',
  'mistral-medium-(2508|latest)',
  'mistral-small',
  'mimo-v2\\.5$',
  'mimo-v2-omni(?:-[\\w-]+)?',
  'glm-5v-turbo'
]

const visionExcludedModels = [
  'gpt-4-\\d+-preview',
  'gpt-4-turbo-preview',
  'gpt-4-32k',
  'gpt-4-\\d+',
  'o1-mini',
  'o3-mini',
  'o1-preview',
  'AIDC-AI/Marco-o1'
]

const VISION_REGEX = new RegExp(
  `\\b(?!(?:${visionExcludedModels.join('|')})\\b)(${visionAllowedModels.join('|')})\\b`,
  'i'
)

const IMAGE_ENHANCEMENT_MODELS = [
  'grok-2-image(?:-[\\w-]+)?',
  'qwen-image-edit',
  'gpt-image-1',
  'gpt-image-2',
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-3(?:\\.\\d+)?-(?:flash|pro)-image(?:-[\\w-]+)?'
]

const IMAGE_ENHANCEMENT_MODELS_REGEX = new RegExp(IMAGE_ENHANCEMENT_MODELS.join('|'), 'i')

/**
 * 判断模型是否支持图片识别（多模态视觉能力）
 */
export function isVisionModel(modelId: string): boolean {
  if (!modelId) return false
  const baseName = getLowerBaseModelName(modelId)
  return VISION_REGEX.test(baseName) || IMAGE_ENHANCEMENT_MODELS_REGEX.test(baseName) || false
}

/**
 * 判断模型/提供商类型是否支持原生 PDF 多模态文件输入
 */
export function supportsNativePdf(modelId: string, providerType?: string): boolean {
  if (!modelId) return false
  const lowerModel = modelId.toLowerCase()
  const lowerProvider = providerType?.toLowerCase() || ''

  // 必须是原生的提供商类型才可能支持原生 PDF (如官方 Gemini SDK 或 Anthropic SDK 渠道)
  // 如果是 openai 兼容端中转，即便模型叫 gemini-3-flash，它通过 openai 协议传输也无法识别 type: 'file' 的 Part 变体
  const isGoogleOrGeminiProvider =
    lowerProvider.includes('google') || lowerProvider.includes('gemini')
  const isAnthropicProvider = lowerProvider.includes('anthropic')
  const isDashscopeProvider =
    lowerProvider.includes('dashscope') || lowerProvider.includes('alibaba')

  if (!isGoogleOrGeminiProvider && !isAnthropicProvider && !isDashscopeProvider) {
    return false
  }

  // 1. Google Gemini 官方渠道具备原生的多模态文件输入支持
  if (isGoogleOrGeminiProvider) {
    if (lowerModel.includes('gemini') || lowerModel.includes('google/')) return true
  }

  // 2. 阿里千问官方专属文档模型
  if (isDashscopeProvider) {
    if (lowerModel.includes('qwen-long') || lowerModel.includes('qwen-doc')) return true
  }

  // 3. Anthropic Claude 3.5 以上官方渠道原生支持 PDF
  if (
    lowerModel.includes('claude-3-5') ||
    lowerModel.includes('claude-3.5') ||
    lowerModel.includes('claude-3-7') ||
    lowerModel.includes('claude-3.7')
  ) {
    if (isAnthropicProvider) return true
  }

  return false
}
