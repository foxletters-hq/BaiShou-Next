import type { KnowledgeExtractHint, VisionExtractHintReason } from '@baishou/shared'

export function describeVisionExtractHint(
  reason: VisionExtractHintReason | null
): string {
  if (reason === 'garbled-text-layer') {
    return '抽样页的文字层已经损坏，继续按文字层导入容易得到乱码。请选择这次怎么抽出文字。'
  }
  return '抽样页几乎抽不到可用文字，更像扫描件。请选择这次怎么抽出文字。'
}

export function collectVisionExtractHints(
  hints: KnowledgeExtractHint[]
): KnowledgeExtractHint[] {
  return hints.filter((row) => row.recommendVision)
}

export function pickVisionExtractHintReason(
  hints: KnowledgeExtractHint[]
): VisionExtractHintReason | null {
  if (hints.some((row) => row.reason === 'garbled-text-layer')) return 'garbled-text-layer'
  if (hints.some((row) => row.reason === 'empty-text-layer')) return 'empty-text-layer'
  return null
}
