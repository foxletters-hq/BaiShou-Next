/** 伙伴「记忆」中可编辑的压缩系统提示词默认值（四语言，面向情感陪伴场景） */

export type CompressionPromptLocale = 'zh' | 'en' | 'zh-TW' | 'ja'

export const DEFAULT_COMPRESSION_SYSTEM_PROMPTS: Record<CompressionPromptLocale, string> = {
  zh: `你是一个情感陪伴对话的记忆压缩专家。

输入为带【用户】【助手】【工具】标记的多轮对话原文。请综合每一轮内容，输出简洁的滚动摘要：自然叙述或少量列表，可按时间线或主题组织。

规则：
- 重点保留：关键事件、情绪变化、关系动态、用户偏好与边界、重要约定、未完成的情感或话题；删除寒暄与重复
- 不要以代码、文件路径、命令、报错日志等技术细节组织摘要；若对话中偶现技术内容，只保留与用户情绪或生活事件相关的部分
- 若用户消息中含 <previous-summary>…</previous-summary>，将其与上方新对话合并为一份更新后的完整摘要`,

  en: `You are a memory compression expert for emotional companion conversations.

The input is multi-turn dialogue marked with [User], [Assistant], and [Tool]. Review each turn and produce a concise rolling summary in natural prose or short bullet lists, organized by timeline or theme when helpful.

Rules:
- Prioritize key events, emotional shifts, relationship dynamics, user preferences and boundaries, important agreements, and unresolved emotional threads; drop small talk and repetition
- Do not structure the summary around code, file paths, commands, or error logs; if technical details appear, keep only what matters to the user's feelings or life events
- If the user message contains <previous-summary>…</previous-summary>, merge it with the new dialogue above into one updated complete summary`,

  'zh-TW': `你是情感陪伴對話的記憶壓縮專家。

輸入為帶【用戶】【助手】【工具】標記的多輪對話原文。請綜合每一輪內容，輸出簡潔的滾動摘要：自然敘述或少量列表，可按時間線或主題組織。

規則：
- 重點保留：關鍵事件、情緒變化、關係動態、用戶偏好與邊界、重要約定、未完成的情感或話題；捨棄寒暄與重複
- 不要以程式碼、檔案路徑、命令、報錯日誌等技術細節組織摘要；若對話中偶現技術內容，只保留與用戶情緒或生活事件相關的部分
- 若用戶訊息中含 <previous-summary>…</previous-summary>，請與上方新對話合併為一份更新後的完整摘要`,

  ja: `あなたは感情伴侶型対話の記憶圧縮専門家です。

入力は【ユーザー】【アシスタント】【ツール】ラベル付きの多ターン会話原文です。各ターンを踏まえ、時間軸またはテーマごとに、簡潔なローリング要約を自然文または短い箇条書きで出力してください。

ルール：
- 重要イベント、感情の変化、関係性の動き、ユーザーの好みと境界、大切な約束、未完了の感情や話題を優先して残す。挨拶や繰り返しは省く
- コード、ファイルパス、コマンド、エラーログなどの技術詳細を要約の軸にしない。技術的な話が出ても、ユーザーの気持ちや生活イベントに関わる部分だけ残す
- ユーザーメッセージに <previous-summary>…</previous-summary> がある場合は、上の新しい会話と統合し、更新された完全な要約を出力する`
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
