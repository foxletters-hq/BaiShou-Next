import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'index.tsx'), 'utf8')
const css = readFileSync(join(here, '..', 'AIGlobalModelsView.module.css'), 'utf8')

describe('AIGlobalModelsView graph slot', () => {
  it('should let the graph extract model be chosen independently of dialogue', () => {
    expect(src).toContain("activeSelector === 'graph'")
    expect(src).toContain('newConfig.globalGraphProviderId = providerId')
    expect(src).toContain('config.globalGraphProviderId')
    expect(src).toContain('config.globalGraphModelId')
    expect(src).not.toContain('图关系抽取始终跟随对话模型')
    expect(src).not.toContain('{ readOnly: true }')
  })

  it('should persist reasoning effort by model use on non-embedding pickers', () => {
    expect(src).toContain('SessionModelMenu')
    expect(src).toContain('reasoningEffortBySlot')
    expect(src).toContain('setReasoningEffortForSlot')
    expect(src).toContain('showReasoningPanel')
  })

  it('should use SessionModelMenu for embedding without a reasoning panel', () => {
    expect(src).not.toContain('ModelSwitcherPopup')
    expect(src).toContain('embeddingProviders')
    expect(src).toContain('showReasoningPanel={Boolean(selectorReasoningSlot(activeSelector))}')
  })

  it('should use two columns by default and three only when the page scroll container is wide enough', () => {
    const chromeCss = readFileSync(
      join(here, '../../shared/SettingsPageChrome.module.css'),
      'utf8'
    )
    expect(chromeCss).toContain('container-name: settings-page-scroll')
    expect(css).toContain('width: 100%')
    expect(css.indexOf('repeat(2, minmax(0, 1fr))')).toBeLessThan(
      css.indexOf('repeat(3, minmax(18rem, 1fr))')
    )
    expect(css).toContain('@container settings-page-scroll (min-width: 64rem)')
    expect(css).toContain('@container settings-page-scroll (max-width: 36rem)')
    expect(css).not.toContain('--model-card-max')
    expect(css).not.toContain('min-width: 84rem')
    expect(css).not.toContain('min-width: 56rem')
    expect(css).not.toContain('auto-fill')
    expect(css).not.toContain('auto-fit')
  })
})
