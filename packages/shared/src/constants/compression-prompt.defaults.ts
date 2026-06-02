/** 伙伴「记忆」中可编辑的压缩系统提示词默认值（四语言） */

export type CompressionPromptLocale = 'zh' | 'en' | 'zh-TW' | 'ja'

export const DEFAULT_COMPRESSION_SYSTEM_PROMPTS: Record<CompressionPromptLocale, string> = {
  zh: `你是一个对话记忆压缩专家。
输入为带【用户】【助手】【工具】标记的多轮对话原文。你必须综合每一轮：用户问了什么、助手/工具答了什么，按主题写成滚动摘要。
提取事实（人名、决策、代码、偏好、待办），删除寒暄与重复。若提供旧摘要，与本轮新信息合并为一份更新版。
严禁只输出最后一条助手回复、感谢语或礼貌收尾；摘要必须让读者不看原文也能知道用户曾提出哪些诉求。`,

  en: `You are a master of memory compression and distillation.
Review the conversation history provided, produce a concise knowledge-oriented summary, keep critical facts (names, places, code, decisions, preferences), and drop small talk and repetition.
If a previous summary is provided, merge it with the new messages into one updated summary.
Stay compact without losing essential context; the result will serve as long-term memory for later turns.`,

  'zh-TW': `你是記憶壓縮與提純大師。
請仔細翻閱提供的大段對話歷史，給出精簡、知識化的總結，保留重要事實（人名、地名、程式碼、決策與偏好等），捨棄寒暄與重複。
若提供舊摘要，請將舊摘要與新訊息合併為一份完整更新版摘要。
輸出應精煉緊湊，不可隨意刪除關鍵上下文；它將作為長程記憶載體供後續對話使用。`,

  ja: `あなたは記憶の圧縮と精製の専門家です。
提供された長い会話履歴を読み、簡潔で知識的な要約を作成してください。重要な事実（人名・地名・コード・決定・好みなど）を残し、挨拶や繰り返しは省きます。
旧要約がある場合は、旧要約と新しいメッセージを統合した完全な更新版を出力してください。
要約はコンパクトにしつつ、後続の会話に必要な文脈を削らないでください。`
}

export function resolveCompressionPromptLocale(locale?: string): CompressionPromptLocale {
  const raw = (locale || 'zh').toLowerCase()
  if (raw.startsWith('zh-tw') || raw === 'zh_hant' || raw === 'zh-hant') return 'zh-TW'
  if (raw.startsWith('zh')) return 'zh'
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('en')) return 'en'
  return 'zh'
}

export function getDefaultCompressionSystemPrompt(locale?: string): string {
  const key = resolveCompressionPromptLocale(locale)
  return DEFAULT_COMPRESSION_SYSTEM_PROMPTS[key]
}
