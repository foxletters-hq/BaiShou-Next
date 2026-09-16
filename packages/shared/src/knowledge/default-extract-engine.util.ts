/** 设置里可选的默认提取方式：先抽文字层，缺页再按这项补。 */
export type KnowledgeDefaultExtractEngine = 'ocr' | 'vision'

/** 把旧的「只抽文字层」和未知值收成可补页的默认方式。 */
export function normalizeKnowledgeDefaultExtractEngine(
  value: unknown
): KnowledgeDefaultExtractEngine {
  if (value === 'vision') return 'vision'
  return 'ocr'
}
