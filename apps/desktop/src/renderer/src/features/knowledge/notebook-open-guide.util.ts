import { i18n } from '@baishou/shared'

export type NotebookOpenGuideRow = {
  key: string
  label: string
  value: string
  warn?: boolean
  iconSrc?: string
}

export type NotebookStatusPickKey = 'embedding' | 'graphExtract' | 'vision' | 'engine'

const PICKABLE_KEYS = new Set<string>(['embedding', 'graphExtract', 'vision', 'engine'])

export function isNotebookStatusPickable(key: string): key is NotebookStatusPickKey {
  return PICKABLE_KEYS.has(key)
}

export function resolveNotebookStatusPicker(
  key: NotebookStatusPickKey,
  anchor: DOMRect
):
  | { action: 'settings' }
  | {
      action: 'picker'
      kind: 'embedding' | 'chat' | 'vision'
      field: 'embedding' | 'graph' | 'vision'
      persistVision: boolean
      anchor: DOMRect
    } {
  if (key === 'engine') return { action: 'settings' }
  if (key === 'embedding') {
    return { action: 'picker', kind: 'embedding', field: 'embedding', persistVision: false, anchor }
  }
  if (key === 'graphExtract') {
    return { action: 'picker', kind: 'chat', field: 'graph', persistVision: false, anchor }
  }
  return { action: 'picker', kind: 'vision', field: 'vision', persistVision: true, anchor }
}

export function formatNotebookModelLabel(modelId: string | null | undefined): string {
  const value = modelId?.trim() || ''
  return value || ''
}

export function buildNotebookOpenGuideRows(input: {
  embeddingModelId?: string | null
  graphModelId?: string | null
  visionModelId?: string | null
  extractEngine?: string | null
  sourceCount: number
  icons?: Partial<Record<'embedding' | 'graphExtract' | 'vision', string>>
}): NotebookOpenGuideRow[] {
  const graphExtract = formatNotebookModelLabel(input.graphModelId)
  const embedding = formatNotebookModelLabel(input.embeddingModelId)
  const vision = formatNotebookModelLabel(input.visionModelId)
  const engine =
    input.extractEngine === 'ocr'
      ? 'OCR'
      : input.extractEngine === 'vision'
        ? i18n.t('knowledge.engine_vision_short', '视觉模型')
        : i18n.t('knowledge.engine_text_extract', '文本提取')
  return [
    {
      key: 'embedding',
      label: i18n.t('knowledge.embedding_model', '嵌入模型'),
      value: embedding || i18n.t('common.not_configured', '未配置'),
      warn: !embedding,
      iconSrc: input.icons?.embedding
    },
    {
      key: 'graphExtract',
      label: i18n.t('knowledge.graph_extract_model', '图抽取模型'),
      value: graphExtract || i18n.t('common.not_configured', '未配置'),
      warn: !graphExtract,
      iconSrc: input.icons?.graphExtract
    },
    {
      key: 'vision',
      label: i18n.t('knowledge.vision_model', '视觉模型'),
      value: vision || i18n.t('knowledge.follow_chat_model', '跟随对话模型'),
      iconSrc: input.icons?.vision
    },
    {
      key: 'engine',
      label: i18n.t('knowledge.default_engine', '默认提取方式'),
      value: engine
    },
    {
      key: 'sources',
      label: i18n.t('knowledge.sources_panel', '来源'),
      value: i18n.t('knowledge.source_count_short', '{{count}} 个', {
        count: Math.max(0, input.sourceCount)
      })
    }
  ]
}
