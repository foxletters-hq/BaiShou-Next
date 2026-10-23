import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
} from '../types/summary.types'
import type {
  AIProviderConfig,
  SummaryConfig,
  SummaryGenerationMode
} from '../types/settings.types'
import type { SummaryPromptLocale } from '../types/summary-prompt.types'
import { getDefaultCustomGenerationSystemPrompt } from '../constants/summary-generation-system-prompt.defaults'
import { resolveSummaryPromptLocale } from './summary-template.util'

export interface SummaryAssistantSnapshot {
  id: string
  name?: string
  systemPrompt?: string | null
  providerId?: string | null
  modelId?: string | null
}

export interface ResolvedSummaryGeneration {
  mode: SummaryGenerationMode
  /** 伙伴模式不填；由桌面/移动端解析全局总结模型后再写入请求 */
  providerId?: string
  modelId?: string
  systemPrompt?: string
  injectSharedMemoryBeforeGenerate: boolean
  sharedMemoryLookbackMonths: number
  /** 请求伙伴模式但伙伴缺失时回退提示词模式 */
  fellBackToPrompt: boolean
}

export function normalizeSummaryGenerationMode(value: unknown): SummaryGenerationMode {
  return value === 'assistant' ? 'assistant' : 'prompt'
}

/** 自定义提示词模式下的生成回忆助手 system prompt（按 promptLocale；空则用出厂默认） */
export function resolveCustomGenerationSystemPrompt(
  config: SummaryConfig | null | undefined,
  locale?: string
): string | undefined {
  const promptLocale = resolveSummaryPromptLocale(locale ?? config?.promptLocale)
  const text = config?.customGenerationSystemPromptByLocale?.[promptLocale]?.trim()
  return text || getDefaultCustomGenerationSystemPrompt(promptLocale)
}

export interface SummaryIdentityContextInput {
  /** 用户昵称（日记作者） */
  userName?: string | null
  /** 用户身份卡 / persona 事实，明确标注为用户本人 */
  userCard?: string | null
  /** 当前 AI 伙伴名称 */
  companionName?: string | null
  locale?: SummaryPromptLocale | string
}

const SUMMARY_IDENTITY_FALLBACK: Record<
  SummaryPromptLocale,
  { user: string; companion: string; heading: string; userCard: string }
> = {
  zh: {
    user: '用户（未设置昵称）',
    companion: 'AI 伙伴（未命名）',
    heading: '## 角色与称呼（必须遵守）',
    userCard: '用户身份卡（只用于识别用户，不要当成 AI 伙伴的设定）'
  },
  'zh-TW': {
    user: '使用者（未設定暱稱）',
    companion: 'AI 夥伴（未命名）',
    heading: '## 角色與稱呼（必須遵守）',
    userCard: '使用者身份卡（只用於辨識使用者，不要當成 AI 夥伴的設定）'
  },
  en: {
    user: 'the user (no nickname set)',
    companion: 'the AI companion (unnamed)',
    heading: '## Roles and names (must follow)',
    userCard: 'User identity card (for identifying the user only; not the AI companion’s persona)'
  },
  ja: {
    user: 'ユーザー（ニックネーム未設定）',
    companion: 'AI パートナー（名前未設定）',
    heading: '## 役割と呼称（必ず守る）',
    userCard: 'ユーザーの identity card（ユーザー識別用。AI パートナーの設定ではない）'
  }
}

const SUMMARY_IDENTITY_LINES: Record<SummaryPromptLocale, string[]> = {
  zh: [
    '素材中的第一人称「我」指用户本人，不是 AI 伙伴。',
    '禁止把用户与 AI 伙伴的身份、情绪、行为对调。',
    '不要给 AI 伙伴套用应用/系统默认名；应用名不是人物名。',
    '素材里的其他人物按原文称呼保留；身份不确定时使用上面的称呼，不要臆测。',
    '若共同回忆或旧总结与本角色对照冲突，以本角色对照为准，并在本期输出中纠正称呼，不要沿用旧错误。'
  ],
  'zh-TW': [
    '素材中的第一人稱「我」指使用者本人，不是 AI 夥伴。',
    '禁止把使用者與 AI 夥伴的身份、情緒、行為對調。',
    '不要給 AI 夥伴套用應用程式/系統預設名；應用程式名不是人物名。',
    '素材裡的其他人物按原文稱呼保留；身份不確定時使用上面的稱呼，不要臆測。',
    '若共同回憶或舊總結與本角色對照衝突，以本角色對照為準，並在本期輸出中糾正稱呼，不要沿用舊錯誤。'
  ],
  en: [
    'In the source material, first-person “I” refers to the user, never the AI companion.',
    'Never swap the user’s and the AI companion’s identities, feelings, or actions.',
    'Do not give the AI companion the application/default system name; the application name is not a character name.',
    'Keep other people’s names as written. If a role is unclear, use the names above; do not guess.',
    'If shared memory or an older summary conflicts with these roles, follow this role mapping and correct the names in this period’s output—do not carry the old mistake forward.'
  ],
  ja: [
    '素材の一人称「私」はユーザー本人であり、AI パートナーではありません。',
    'ユーザーと AI パートナーの身元・感情・行動を入れ替えないでください。',
    'AI パートナーにアプリ/システムの既定名を付けないでください。アプリ名は人物名ではありません。',
    '他の人物は素材の呼称をそのまま使う。役割が不明なときは上記の呼称を使い、推測しない。',
    '共有の思い出や過去のまとめがこの役割と食い違う場合は、この役割を優先し、今期の出力で呼称を訂正してください。過去の誤りを引き継がないでください。'
  ]
}

const SUMMARY_IDENTITY_LABELS: Record<SummaryPromptLocale, { user: string; companion: string }> = {
  zh: { user: '日记作者 / 用户', companion: 'AI 伙伴' },
  'zh-TW': { user: '日記作者 / 使用者', companion: 'AI 夥伴' },
  en: { user: 'Diary author / user', companion: 'AI companion' },
  ja: { user: '日記の書き手 / ユーザー', companion: 'AI パートナー' }
}

/** 生成总结时的角色对照块：明确用户与伙伴身份，避免「我」与默认名串位 */
export function buildSummaryIdentitySystemPrompt(input: SummaryIdentityContextInput): string {
  const locale = resolveSummaryPromptLocale(input.locale)
  const fallback = SUMMARY_IDENTITY_FALLBACK[locale]
  const labels = SUMMARY_IDENTITY_LABELS[locale]
  const userName = input.userName?.trim() || fallback.user
  const companionName = input.companionName?.trim() || fallback.companion
  const colon = locale === 'en' ? ': ' : '：'
  const lines = [
    fallback.heading,
    `- ${labels.user}${colon}${userName}`,
    `- ${labels.companion}${colon}${companionName}`,
    ...SUMMARY_IDENTITY_LINES[locale]
  ]
  const userCard = input.userCard?.trim()
  if (userCard) {
    lines.push('', `${fallback.userCard}${colon}`, userCard)
  }
  return lines.join('\n')
}

function promptModeRuntime(
  config: SummaryConfig | null | undefined,
  injectSharedMemoryBeforeGenerate: boolean,
  sharedMemoryLookbackMonths: number,
  fellBackToPrompt: boolean
): ResolvedSummaryGeneration {
  return {
    mode: 'prompt',
    systemPrompt: resolveCustomGenerationSystemPrompt(config),
    injectSharedMemoryBeforeGenerate,
    sharedMemoryLookbackMonths,
    fellBackToPrompt
  }
}

export function resolveSummaryGenerationRuntime(
  config: SummaryConfig | null | undefined,
  assistant: SummaryAssistantSnapshot | null | undefined,
  _providers?: AIProviderConfig[] | null
): ResolvedSummaryGeneration {
  const injectSharedMemoryBeforeGenerate = !!config?.injectSharedMemoryBeforeGenerate
  const sharedMemoryLookbackMonths =
    config?.sharedMemoryLookbackMonths !== undefined
      ? clampSharedMemoryLookbackMonths(config.sharedMemoryLookbackMonths)
      : DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS

  const requestedMode = normalizeSummaryGenerationMode(config?.generationMode)
  if (requestedMode !== 'assistant') {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      false
    )
  }

  const assistantId = config?.generationAssistantId?.trim()
  if (!assistantId || !assistant || String(assistant.id) !== assistantId) {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      true
    )
  }

  // 伙伴模式：只复用伙伴 systemPrompt；模型一律由调用方解析全局总结模型
  const systemPrompt = assistant.systemPrompt?.trim()
  return {
    mode: 'assistant',
    systemPrompt: systemPrompt || undefined,
    injectSharedMemoryBeforeGenerate,
    sharedMemoryLookbackMonths,
    fellBackToPrompt: false
  }
}

const TEMPLATE_SECTION_TITLE: Record<SummaryPromptLocale, string> = {
  zh: '## 生成总结模板',
  en: '## Summary Output Template',
  ja: '## まとめ出力テンプレート',
  'zh-TW': '## 生成總結模板'
}

const TEMPLATE_SECTION_INTRO: Record<SummaryPromptLocale, string> = {
  zh:
    '以下是本期总结的输出版式。请严格按此模板的标题层级与结构填充，用真实内容替换占位示例；' +
    '不要输出模板以外的开场白、结束语或元说明。',
  en:
    'Below is the output format for this period’s summary. Fill it strictly by the same heading levels and structure, ' +
    'replacing placeholders with real content. Do not add greetings, closings, or meta commentary outside the template.',
  ja:
    '以下は今期まとめの出力フォーマットです。見出し階層と構造を厳守して埋め、プレースホルダーを実際の内容に置き換えてください。' +
    'テンプレート外の挨拶・結び・メタ説明は出力しないでください。',
  'zh-TW':
    '以下是本期總結的輸出版式。請嚴格按此模板的標題層級與結構填充，用真實內容替換佔位示例；' +
    '不要輸出模板以外的開場白、結束語或元說明。'
}

const SHARED_MEMORY_INJECT_TITLE: Record<SummaryPromptLocale, string> = {
  zh: '## 共同回忆（生成前注入）',
  en: '## Shared Memory (injected before generation)',
  ja: '## 共有の思い出（生成前に注入）',
  'zh-TW': '## 共同回憶（生成前注入）'
}

/**
 * 注入共同回忆时给模型的阅读说明：先了解背景，再依据本期数据源写作。
 * 与标题同属 prompt 组装文案，按总结 promptLocale 切换。
 */
const SHARED_MEMORY_INJECT_INTRO: Record<SummaryPromptLocale, string> = {
  zh:
    '接下来会提供「本期开始之前」的共同回忆。请先阅读并了解这些背景，以便把握长期脉络与连贯性；' +
    '然后根据后方「本期数据源」中的素材，按上方「生成总结模板」完成本期总结。' +
    '共同回忆仅作背景参考，不得覆盖、改写或臆造本期事实。',
  en:
    'Next you will receive Shared Memory from before this period. First read and understand that background for long-term continuity; ' +
    'then complete this period’s summary from the “Period Data Sources” section below, following the “Summary Output Template” above. ' +
    'Treat Shared Memory as background only—do not override, rewrite, or invent facts for this period.',
  ja:
    '次に「今期開始より前」の共有の思い出を渡します。まずその背景を読んで長期的な流れと一貫性を把握し、' +
    'その後の「今期データソース」の素材に基づき、上の「まとめ出力テンプレート」に従って今期のまとめを作成してください。' +
    '共有の思い出は背景参考のみであり、今期の事実を上書き・改変・創作してはいけません。',
  'zh-TW':
    '接下來會提供「本期開始之前」的共同回憶。請先閱讀並了解這些背景，以便掌握長期脈絡與連貫性；' +
    '然後根據後方「本期資料來源」中的素材，依上方「生成總結模板」完成本期總結。' +
    '共同回憶僅作背景參考，不得覆蓋、改寫或臆造本期事實。'
}

const PERIOD_DATA_SECTION_TITLE: Record<SummaryPromptLocale, string> = {
  zh: '## 本期数据源',
  en: '## Period Data Sources',
  ja: '## 今期データソース',
  'zh-TW': '## 本期資料來源'
}

const PERIOD_DATA_SECTION_INTRO: Record<SummaryPromptLocale, string> = {
  zh: '以下是本期需要总结的原始素材（日记或下级总结）。请据此并严格按上方「生成总结模板」完成本期总结。',
  en:
    'Below is the raw material for this period (diaries or lower-level summaries). ' +
    'Generate this period’s summary from it, strictly following the “Summary Output Template” above.',
  ja:
    '以下は今期にまとめるべき元データ（日記または下位のまとめ）です。' +
    'これに基づき、上の「まとめ出力テンプレート」に従って今期のまとめを作成してください。',
  'zh-TW':
    '以下是本期需要總結的原始素材（日記或下級總結）。請據此並嚴格依上方「生成總結模板」完成本期總結。'
}

export function getSummarySharedMemoryInjectTitle(locale?: string): string {
  return SHARED_MEMORY_INJECT_TITLE[resolveSummaryPromptLocale(locale)]
}

export function getSummarySharedMemoryInjectIntro(locale?: string): string {
  return SHARED_MEMORY_INJECT_INTRO[resolveSummaryPromptLocale(locale)]
}

export function getSummaryTemplateSectionTitle(locale?: string): string {
  return TEMPLATE_SECTION_TITLE[resolveSummaryPromptLocale(locale)]
}

export function getSummaryTemplateSectionIntro(locale?: string): string {
  return TEMPLATE_SECTION_INTRO[resolveSummaryPromptLocale(locale)]
}

export function getSummaryPeriodDataSectionTitle(locale?: string): string {
  return PERIOD_DATA_SECTION_TITLE[resolveSummaryPromptLocale(locale)]
}

export function getSummaryPeriodDataSectionIntro(locale?: string): string {
  return PERIOD_DATA_SECTION_INTRO[resolveSummaryPromptLocale(locale)]
}

/** 组装总结生成的 user prompt：模板 → 可选共同回忆（含说明）→ 本期原始数据 */
export function assembleSummaryGenerationPrompt(params: {
  promptTemplate: string
  dataPrefix: string
  contextData: string
  sharedContextText?: string
  sharedMemorySectionTitle?: string
  sharedMemoryIntro?: string
  promptLocale?: string
}): string {
  const locale = params.promptLocale
  const templateTitle = getSummaryTemplateSectionTitle(locale)
  const templateIntro = getSummaryTemplateSectionIntro(locale)
  const parts: string[] = [
    `---\n\n${templateTitle}\n\n${templateIntro}\n\n${params.promptTemplate}`
  ]

  const shared = params.sharedContextText?.trim()
  if (shared) {
    const title = params.sharedMemorySectionTitle ?? getSummarySharedMemoryInjectTitle(locale)
    const intro = params.sharedMemoryIntro ?? getSummarySharedMemoryInjectIntro(locale)
    parts.push(`---\n\n${title}\n\n${intro}\n\n${shared}`)
  }

  const periodTitle = getSummaryPeriodDataSectionTitle(locale)
  const periodIntro = getSummaryPeriodDataSectionIntro(locale)
  // dataPrefix 保留兼容；分区 intro 已说明用途，避免重复堆叠时仍放在分区标题下
  const periodBody = params.dataPrefix?.trim()
    ? `${periodIntro}\n\n${params.dataPrefix}\n\n${params.contextData}`
    : `${periodIntro}\n\n${params.contextData}`
  parts.push(`---\n\n${periodTitle}\n\n${periodBody}`)

  return parts.join('\n\n')
}
