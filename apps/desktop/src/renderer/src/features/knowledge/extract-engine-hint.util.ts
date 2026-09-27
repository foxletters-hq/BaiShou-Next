import {
  collectVisionExtractHints,
  i18n,
  pickVisionExtractHintReason,
  type VisionExtractHintReason
} from '@baishou/shared'

export { collectVisionExtractHints, pickVisionExtractHintReason }

export function describeVisionExtractHint(reason: VisionExtractHintReason | null): string {
  if (reason === 'garbled-text-layer') {
    return i18n.t(
      'knowledge.extract_hint_garbled',
      '抽样页的文字层已经损坏，继续按文字层导入容易得到乱码。请选择这次怎么抽出文字。'
    )
  }
  return i18n.t(
    'knowledge.extract_hint_empty',
    '抽样页几乎抽不到可用文字，更像扫描件。请选择这次怎么抽出文字。'
  )
}
