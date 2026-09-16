export type KnowledgeExtractEngineId = 'simple' | 'ocr' | 'vision'

export function knowledgeExtractSettingsVisibility(engine: KnowledgeExtractEngineId): {
  showOcrSettings: boolean
  showVisionSettings: boolean
} {
  return {
    showOcrSettings: engine !== 'vision',
    showVisionSettings: engine === 'vision'
  }
}
