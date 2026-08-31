import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ALL_SIDEBAR_NAV_IDS,
  DEFAULT_VISIBLE_NAV_IDS
} from '../../../components/Sidebar/sidebar-nav-catalog'
import { MAIN_PAGE_CACHE, getMainPageCacheKey } from '../../../layouts/MainPageCache'

const here = dirname(fileURLToPath(import.meta.url))
const rendererSrc = join(here, '../../..')
const repoRoot = join(rendererSrc, '../../../../..')

function readSrc(relativeFromRendererSrc: string): string {
  return readFileSync(join(rendererSrc, relativeFromRendererSrc), 'utf8')
}

describe('memory center chrome', () => {
  it('A6: GraphPage and RagSettingsPane both import MemoryReadinessBar', () => {
    expect(readSrc('features/graph/GraphPage.tsx')).toContain(
      "import { MemoryReadinessBar } from '../memory/MemoryReadinessBar'"
    )
    expect(readSrc('features/settings/components/RagSettingsPane.tsx')).toContain(
      "import { MemoryReadinessBar } from '../../memory/MemoryReadinessBar'"
    )
  })

  it('B2: MainPageCache maps /memory and /memory/vectors to the memory page', () => {
    expect(MAIN_PAGE_CACHE).toHaveProperty('/memory')
    expect(getMainPageCacheKey('/memory/vectors')).toBe('/memory')
    expect(getMainPageCacheKey('/memory/graph')).toBe('/memory')
  })

  it('B3: old graph and rag routes redirect into memory tabs', () => {
    const app = readSrc('App.tsx')
    expect(app).toContain('path="/graph"')
    expect(app).toContain('to="/memory/graph"')
    expect(app).toContain('path="/hub/rag"')
    expect(app).toContain('to="/memory/vectors"')
  })

  it('B4b: settings overlay keeps memory in-place instead of leaving for /memory', () => {
    const shell = readSrc('features/settings/SettingsShell.tsx')
    const content = readSrc('features/settings/SettingsContentView.tsx')
    expect(shell).toContain("t('nav.memory', '记忆')")
    expect(shell).toContain('PawPrint')
    expect(shell).not.toContain("navigate('/memory')")
    expect(shell).not.toContain('/memory/vectors')
    expect(content).toContain('<MemoryCenterPage embedded />')
    expect(content).not.toContain('Navigate to="/memory')
  })

  it('B4: sidebar catalog replaces graph/rag with a visible memory item', () => {
    expect(ALL_SIDEBAR_NAV_IDS).toContain('memory')
    expect(ALL_SIDEBAR_NAV_IDS).not.toContain('graph')
    expect(ALL_SIDEBAR_NAV_IDS).not.toContain('rag')
    expect(DEFAULT_VISIBLE_NAV_IDS).toContain('memory')
  })

  it('B6: MemoryVectorTab loads rag config on mount', () => {
    const src = readSrc('features/memory/MemoryVectorTab.tsx')
    expect(src).toContain("ensureConfigForSegment('rag')")
  })

  it('B7: MemoryCenterPage uses SegmentedControl and does not hand-roll tab buttons', () => {
    const src = readSrc('features/memory/MemoryCenterPage.tsx')
    expect(src).toContain('SegmentedControl')
    expect(src).not.toContain('btnActive')
    expect(src).toContain("value: 'vectors' as const")
    expect(src.indexOf("value: 'vectors' as const")).toBeLessThan(
      src.indexOf("value: 'graph' as const")
    )
    expect(src).toContain("to=\"/memory/vectors\"")
    expect(src).toContain('<MemoryHelpButton')
    expect(src).not.toContain('HelpTooltip')
  })

  it('B8: DiaryPage status bar jumps to memory tabs', () => {
    const src = readSrc('features/diary/DiaryPage.tsx')
    expect(src).toContain("navigate('/memory/graph')")
    expect(src).toContain("navigate('/memory/vectors')")
  })

  it('C3: memory help stays mounted independently of onboarding', () => {
    const page = readSrc('features/memory/MemoryCenterPage.tsx')
    const help = readSrc('features/memory/MemoryHelpButton.tsx')
    expect(page).toContain('<MemoryHelpButton')
    expect(help).toContain('<MemoryNotebookNotice')
    const helpIndex = page.indexOf('<MemoryHelpButton')
    const onboardingIndex = page.indexOf('{showOnboarding ?')
    expect(helpIndex).toBeGreaterThanOrEqual(0)
    expect(onboardingIndex).toBeGreaterThan(helpIndex)
  })

  it('C4: Chinese copy states notebook memory is not merged into the center', () => {
    const zh = JSON.parse(
      readFileSync(join(repoRoot, 'packages/shared/src/i18n/zh.i18n.json'), 'utf8')
    ) as { memory: { lead: string; notebook_notice: string } }
    expect(zh.memory.lead).toContain('不并入这里')
    expect(zh.memory.notebook_notice).toContain('不并入这里')
    expect(zh.memory.notebook_notice).toContain('笔记本')
  })
})
