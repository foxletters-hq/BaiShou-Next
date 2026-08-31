export type NotebookOpenGuideRow = {
  key: string
  label: string
  value: string
  warn?: boolean
}

export function formatNotebookModelLabel(modelId: string | null | undefined): string {
  const value = modelId?.trim() || ''
  return value || ''
}

export function buildNotebookOpenGuideRows(input: {
  embeddingModelId?: string | null
  dialogueModelId?: string | null
  assistantName?: string | null
  assistantModelId?: string | null
  visionModelId?: string | null
  extractEngine?: string | null
  sourceCount: number
  graphPending: number
}): NotebookOpenGuideRow[] {
  const dialogue =
    formatNotebookModelLabel(input.assistantModelId) ||
    formatNotebookModelLabel(input.dialogueModelId)
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
      warn: !embedding
    },
    {
      key: 'dialogue',
      label: '对话模型',
      value: dialogue || '未配置',
      warn: !dialogue
    },
    {
      key: 'assistant',
      label: '当前伙伴',
      value: input.assistantName?.trim() || '未选择'
    },
    {
      key: 'vision',
      label: '视觉模型',
      value: vision || '跟随对话模型'
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
    },
    {
      key: 'graph',
      label: '图谱抽取',
      value: input.graphPending > 0 ? `进行中 ${input.graphPending} 项` : '空闲',
      warn: input.graphPending > 0
    }
  ]
}
