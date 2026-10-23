export * from './types'
export * from './adapters'
export * from './tesseract-worker-path.util'
export * from './simple.engine'
export * from './ocr.engine'
export * from './vision.engine'
export * from './simple-page-cache'
export * from './pool.util'

import { simpleExtractEngine } from './simple.engine'
import { ocrExtractEngine } from './ocr.engine'
import { visionExtractEngine } from './vision.engine'
import type { ExtractEngine, ExtractEngineId } from './types'

const ENGINES: Record<ExtractEngineId, ExtractEngine> = {
  simple: simpleExtractEngine,
  ocr: ocrExtractEngine,
  vision: visionExtractEngine
}

export function getExtractEngine(id: ExtractEngineId): ExtractEngine {
  return ENGINES[id] ?? simpleExtractEngine
}
