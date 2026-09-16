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

function readRagSrc(fileName: string): string {
  return readFileSync(join(repoRoot, 'packages/ui/src/desktop/RagMemoryView', fileName), 'utf8')
}

describe('memory center chrome', () => {
  it('A6: GraphPage and RagSettingsPane both import MemoryReadinessBar', () => {
    expect(readSrc('features/graph/GraphPage.tsx')).toContain(
      "import { MemoryReadinessBar } from '../memory/MemoryReadinessBar'"
    )
    expect(readSrc('features/settings/components/RagSettingsPane.tsx')).toContain(
      "import { MemoryReadinessBar } from '../../memory/MemoryReadinessBar'"
    )
    expect(readSrc('features/memory/MemoryCenterPage.tsx')).toContain('<MemoryReadinessBar')
    expect(readSrc('features/settings/components/RagSettingsPane.tsx')).toContain('extraStatsChips')
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

  it('title row and status strip keep buttons and labels vertically centered', () => {
    const pageCss = readSrc('features/memory/MemoryCenterPage.module.css')
    const ragCss = readRagSrc('RagMemoryView.module.css')
    const strip = readRagSrc('RagMemoryStatusStrip.tsx')
    expect(pageCss).toMatch(/\.titleRow \{[^}]*flex-wrap: wrap/)
    expect(pageCss).toMatch(/\.titleRow \{[^}]*align-items: center/)
    expect(pageCss).toMatch(/\.title \{[^}]*display: inline-flex/)
    expect(pageCss).toMatch(/\.title \{[^}]*align-items: center/)
    expect(pageCss).toMatch(/\.title \{[^}]*line-height: 1/)
    expect(ragCss).toMatch(/\.statusStrip \{[^}]*align-items: center/)
    expect(ragCss).toMatch(/\.enableChip \{[^}]*align-items: center/)
    expect(ragCss).toMatch(/\.enableChip \{[^}]*line-height: 1/)
    expect(ragCss).toMatch(/\.enableChip > span \{[^}]*align-items: center/)
    expect(strip).toContain('styles.enableChip')
    expect(strip).toContain('styles.extraChips')
  })

  it('B7: MemoryCenterPage uses SegmentedControl and does not hand-roll tab buttons', () => {
    const src = readSrc('features/memory/MemoryCenterPage.tsx')
    expect(src).toContain('SegmentedControl')
    expect(src).not.toContain('btnActive')
    expect(src).toContain("value: 'vectors' as const")
    expect(src.indexOf("value: 'vectors' as const")).toBeLessThan(
      src.indexOf("value: 'graph' as const")
    )
    expect(src).toContain('to="/memory/vectors"')
    expect(src).toContain('<MemoryHelpButton')
    expect(src).not.toContain('HelpTooltip')
    expect(src.indexOf('styles.titleRow')).toBeLessThan(src.indexOf('styles.tabs'))
    expect(src.indexOf('styles.tabs')).toBeLessThan(src.indexOf('</header>'))
  })

  it('vector tab fills the remaining height so the list can scroll', () => {
    const css = readSrc('features/memory/MemoryCenterPage.module.css')
    const pane = readSrc('features/settings/components/RagSettingsPane.tsx')
    expect(css).toContain('.vectorHost :global(.settings-pane)')
    expect(css).toContain('min-height: 0')
    expect(pane).toContain('embedded={embedded}')
  })

  it('vector list shows a searching state while category or query reloads', () => {
    const view = readRagSrc('RagMemoryView.tsx')
    const types = readRagSrc('rag-memory.types.ts')
    const css = readRagSrc('RagMemoryView.module.css')
    const hook = readSrc('features/settings/hooks/useRagSettings.ts')
    const pane = readSrc('features/settings/components/RagSettingsPane.tsx')
    expect(types).toContain('isSearching?: boolean')
    expect(view).toContain('isSearching')
    expect(view).toContain('styles.searchingState')
    expect(view).toContain('settings.rag_searching')
    expect(css).toContain('.searchingState')
    expect(css).toContain('.searchingSpinner')
    expect(hook).toContain('invalidateInFlightListQuery')
    expect(hook).toContain('handleSourceKindChange')
    expect(pane).toContain('isSearching={isSearching}')
  })

  it('vector page keeps exactly one scroll region with pagination pinned under it', () => {
    const view = readRagSrc('RagMemoryView.tsx')
    const css = readRagSrc('RagMemoryView.module.css')
    expect(view).toContain('styles.listScroll')
    expect(view.lastIndexOf('<RagMemoryEntriesList')).toBeLessThan(
      view.lastIndexOf('<RagMemoryPaginationBar')
    )
    expect(css).toMatch(/\.listScroll \{[^}]*overflow-y: auto/)
    expect(css).not.toContain('.scrollArea')
  })

  it('clear memory asks which kinds to delete before running', () => {
    const view = readRagSrc('RagMemoryView.tsx')
    const modal = readRagSrc('RagClearMemoryModal.tsx')
    const toolbar = readRagSrc('RagMemoryToolbar.tsx')
    const hook = readSrc('features/settings/hooks/useRagSystem.ts')
    expect(view).toContain('RagClearMemoryModal')
    expect(toolbar).toContain('onOpenClear')
    expect(toolbar).toContain('moreMenu')
    expect(toolbar).not.toContain('onOpenConsistency')
    expect(toolbar).not.toContain('settings.rag_consistency_title')
    expect(view).not.toContain('RagMemoryConsistencyModal')
    expect(view).not.toContain('RagMemoryConsistencySection')
    expect(modal).toContain('MEMORY_CLEAR_KINDS')
    expect(modal).toContain('settings.rag_clear_kind_node')
    expect(modal).toContain('settings.rag_clear_kind_graph')
    expect(hook).toContain('clearAll({ kinds')
    expect(hook).toContain('clearLifeGraph')
  })

  it('retrieval sliders live in a modal instead of eating the page header', () => {
    const view = readRagSrc('RagMemoryView.tsx')
    const toolbar = readRagSrc('RagMemoryToolbar.tsx')
    expect(view).not.toContain('RagMemoryConfigBlock')
    expect(toolbar).toContain('RagMemoryParamsModal')
    expect(readRagSrc('RagMemoryParamsModal.tsx')).toContain('<RagMemoryConfigBlock')
  })

  it('B8: DiaryPage status bar jumps to memory tabs', () => {
    const src = readSrc('features/diary/DiaryPage.tsx')
    expect(src).toContain("navigate('/memory/graph')")
    expect(src).toContain("navigate('/memory/vectors')")
  })

  it('keeps the wrapping readiness bar at the top and does not render the onboarding card', () => {
    const page = readSrc('features/memory/MemoryCenterPage.tsx')
    const css = readSrc('features/memory/MemoryCenterPage.module.css')
    const bar = readSrc('features/memory/MemoryReadinessBar.tsx')
    const barCss = readSrc('features/memory/MemoryReadinessBar.module.css')
    const toolbar = readRagSrc('RagMemoryToolbar.tsx')
    const zh = JSON.parse(
      readFileSync(join(repoRoot, 'packages/shared/src/i18n/zh.i18n.json'), 'utf8')
    ) as { memory: { readiness_vector_pending: string; readiness_vector_done: string; start_organize: string } }
    expect(page).not.toContain('MemoryOnboardingCard')
    expect(page).not.toContain('showOnboarding')
    expect(page).toContain('<MemoryReadinessBar')
    expect(page).not.toContain('memoryReadinessNeedsBelowTitle')
    expect(page).toContain("const omit: MemoryReadinessRowId[] = ['extract', 'graph']")
    expect(readSrc('features/memory/pending-embed-part-lines.util.ts')).toContain(
      'pending_embed_part_graph_extract'
    )
    expect(bar).toContain('listPendingEmbedPartLines')
    expect(bar).toContain('AnchoredContextMenu')
    expect(bar).toContain('alignEnd')
    expect(bar).toContain('rect.right')
    expect(bar).not.toContain(".join(' · ')")
    expect(bar).toContain('pendingGraphCount')
    expect(page).toContain('styles.titleLead')
    expect(page).toContain('styles.readinessSlot')
    expect(page).not.toContain('styles.readinessInline')
    expect(page).not.toContain('styles.readinessBelow')
    expect(page.indexOf('className={styles.title}>')).toBeLessThan(
      page.indexOf('styles.readinessSlot')
    )
    expect(page.indexOf('styles.titleLead')).toBeLessThan(page.indexOf('styles.readinessSlot'))
    expect(page).not.toContain('styles.readinessTop')
    expect(page).toContain('autoStartOrganize')
    expect(page).toContain('resolveMemoryOrganizeAction')
    expect(page).toContain('startOrganizeMemory')
    expect(page).toContain('finishEmbedThenGraph')
    expect(page).toContain('graphQueueExtract')
    expect(page).not.toContain("selectTab('graph')")
    expect(page).not.toContain("selectTab('vectors')")
    expect(bar).toContain("memory.readiness_need_embedding")
    expect(bar).toContain("memory.go_configure")
    expect(css).toMatch(/\.titleRow \{[^}]*flex-wrap: wrap/)
    expect(css).toMatch(/\.readinessSlot \{[^}]*flex: 1 1 14rem/)
    expect(toolbar).not.toContain('data-rag-action="batch-embed"')
    expect(toolbar).not.toContain('settings.rag_batch_embed')
    expect(bar).toContain('memory.start_organize')
    expect(bar).toContain('未整理 {{count}} 篇')
    expect(bar).not.toContain('未索引')
    expect(barCss).toContain('.chipWrap')
    expect(barCss).toContain('.detailMenu')
    expect(barCss).toMatch(/\.chipWrap \{[^}]*align-items: center/)
    expect(barCss).toMatch(/\.chipWrap \{[^}]*flex-wrap: nowrap/)
    expect(barCss).toMatch(/\.chipWrap \.chipValue \{[^}]*white-space: normal/)
    expect(zh.memory.readiness_vector_pending).toBe('未整理 {{count}} 篇')
    expect(zh.memory.readiness_vector_done).toBe('已全部整理')
    expect(zh.memory.start_organize).toBe('开始整理记忆')
  })

  it('refreshes readiness and the vector list after background organize settles', () => {
    const readiness = readSrc('features/memory/useMemoryReadiness.ts')
    const page = readSrc('features/memory/MemoryCenterPage.tsx')
    const bar = readSrc('features/memory/MemoryReadinessBar.tsx')
    const rag = readSrc('features/settings/hooks/useRagSettings.ts')
    expect(readiness).toContain('graphOnQueueProgress')
    expect(readiness).toContain('graphGetQueueState')
    expect(readiness).toContain('graphExtracting')
    expect(readiness).toContain('refreshMemoryReadiness()')
    expect(page).toContain('extracting={readiness.graphExtracting}')
    expect(page).toContain('void refreshMemoryReadiness()')
    expect(bar).toContain('extracting')
    expect(bar).toContain('graph.extract_progress')
    expect(rag).toContain('embed-pending-changed')
    expect(rag).toContain("type === 'batchEmbed'")
    expect(rag).toContain('reloadRagList')
    expect(readiness).toContain('setMemoryOrganizePipeline')
    expect(readiness).toContain('armGraphExtracting')
    expect(page).toContain("setMemoryOrganizePipeline('embed')")
    expect(page).toContain("setMemoryOrganizePipeline('graph')")
    expect(page).toContain('phaseCountsFromPending')
    expect(page).toContain('firstActivePhase')
    expect(page).toContain('memory.readiness_organizing')
    expect(bar).toContain('readiness_graph_starting')
    expect(readRagSrc('RagMemoryAlerts.tsx')).toContain('completed: item.completed')
    expect(readRagSrc('RagMemoryAlerts.tsx')).not.toContain('completed: item.total')
    expect(readRagSrc('RagMemoryView.tsx')).not.toContain('RagMemoryDiaryEmbedHint')
    expect(readRagSrc('RagMemoryAlerts.tsx')).not.toContain('showEmbedError')
    expect(readSrc('features/settings/hooks/useRagSystem.ts')).toContain(
      "t('settings.rag_batch_embed_failed'"
    )
    expect(readSrc('features/settings/hooks/useRagSystem.ts')).toContain('toast.showError')
    expect(readRagSrc('RagMemoryAlerts.tsx')).toContain('graphExtractWaiting')
    expect(readRagSrc('RagMemoryAlerts.tsx')).toContain('showGraphExtractCard')
    expect(readRagSrc('RagMemoryAlerts.tsx')).toContain('memory.readiness_organizing')
    expect(readRagSrc('RagMemoryAlerts.tsx')).toContain('life_graph')
  })

  it('C3: memory help stays mounted independently of the readiness bar', () => {
    const page = readSrc('features/memory/MemoryCenterPage.tsx')
    const help = readSrc('features/memory/MemoryHelpButton.tsx')
    expect(page).toContain('<MemoryHelpButton')
    expect(help).toContain('<MemoryNotebookNotice')
    const helpIndex = page.indexOf('<MemoryHelpButton')
    const barIndex = page.indexOf('<MemoryReadinessBar')
    expect(helpIndex).toBeGreaterThanOrEqual(0)
    expect(barIndex).toBeGreaterThanOrEqual(0)
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
