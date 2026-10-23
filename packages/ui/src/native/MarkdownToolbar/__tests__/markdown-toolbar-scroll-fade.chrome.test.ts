import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(join(here, '../MarkdownToolbar.tsx'), 'utf8')

describe('Native MarkdownToolbar horizontal scroll fade', () => {
  it('should render a right-edge fade while more tools are off-screen', () => {
    expect(tsx).toContain(
      "import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'"
    )
    expect(tsx).toContain('showScrollFade')
    expect(tsx).toContain('stopColor={colors.bgSurface}')
    expect(tsx).toContain('pointerEvents="none"')
  })

  it('should track viewport, content width and scroll offset', () => {
    expect(tsx).toContain('onContentSizeChange={handleContentSizeChange}')
    expect(tsx).toContain('onScroll={handleScroll}')
    expect(tsx).toContain('scrollEventThrottle={16}')
    expect(tsx).toContain('offsetX + viewportWidth < contentWidth - 1')
  })

  it('should position the fade on the right edge without blocking touches', () => {
    expect(tsx).toContain('scrollFade')
    expect(tsx).toContain("position: 'absolute'")
    expect(tsx).toContain('right: 0')
    expect(tsx).toContain('width: 28')
  })
})
