import { describe, expect, it } from 'vitest'
import { knowledgeExtractSettingsVisibility } from '../knowledge-extract-settings-visibility.util'

describe('knowledgeExtractSettingsVisibility', () => {
  it('should show ocr rows when the stored default is the old text-layer engine', () => {
    expect(knowledgeExtractSettingsVisibility('simple')).toEqual({
      showOcrSettings: true,
      showVisionSettings: false
    })
  })

  it('should show only ocr rows when the default engine is local ocr', () => {
    expect(knowledgeExtractSettingsVisibility('ocr')).toEqual({
      showOcrSettings: true,
      showVisionSettings: false
    })
  })

  it('should show only the vision row when the default engine is a vision model', () => {
    expect(knowledgeExtractSettingsVisibility('vision')).toEqual({
      showOcrSettings: false,
      showVisionSettings: true
    })
  })
})
