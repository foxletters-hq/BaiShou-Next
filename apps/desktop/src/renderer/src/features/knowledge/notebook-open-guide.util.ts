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
        ? '视觉模型'
        : '文本提取'
  return [
    {
      key: 'embedding',
      label: '嵌入模型',
      value: embedding || '未配置',
      warn: !embedding,
      iconSrc: input.icons?.embedding
    },
    {
      key: 'graphExtract',
      label: '图抽取模型',
      value: graphExtract || '未配置',
      warn: !graphExtract,
      iconSrc: input.icons?.graphExtract
    },
    {
      key: 'vision',
      label: '视觉模型',
      value: vision || '跟随对话模型',
      iconSrc: input.icons?.vision
    },
    {
      key: 'engine',
      label: '默认提取方式',
      value: engine
    },
    {
      key: 'sources',
      label: '来源',
      value: `${Math.max(0, input.sourceCount)} 个`
    }
  ]
}
