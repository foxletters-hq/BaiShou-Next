import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(join(here, '../DiaryCard.tsx'), 'utf8')

describe('Native DiaryCard gradient fade chrome', () => {
  it('should use Svg LinearGradient to smoothly fade out truncated content', () => {
    expect(tsx).toContain(
      "import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'"
    )
    expect(tsx).toContain('MAX_CONTENT_HEIGHT')
    expect(tsx).toContain('FADE_HEIGHT')
    expect(tsx).toContain('diary-card-fade-gradient')
    expect(tsx).toContain('pointerEvents="none"')
    expect(tsx).toContain('stopColor={colors.bgSurface}')
  })

  it('should detect truncation via layout measurement and length heuristic', () => {
    expect(tsx).toContain('handleContentLayout')
    expect(tsx).toContain('TRUNCATE_HEIGHT_THRESHOLD')
    expect(tsx).toContain('TRUNCATE_CHAR_THRESHOLD')
    expect(tsx).toContain('isLikelyTruncated')
    expect(tsx).toContain('isTruncated')
  })

  it('should position the gradient overlay at the bottom of contentContainer', () => {
    expect(tsx).toContain("position: 'relative'")
    expect(tsx).toContain("position: 'absolute'")
    expect(tsx).toContain('bottom: 0')
    expect(tsx).toContain('height: FADE_HEIGHT')
  })
})
