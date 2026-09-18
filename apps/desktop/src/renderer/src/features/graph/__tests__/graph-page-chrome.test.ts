import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '../GraphPage.tsx'), 'utf8')
const settingsSrc = readFileSync(join(dir, '../GraphCanvasSettingsPanel.tsx'), 'utf8')
const pickerSrc = readFileSync(join(dir, '../GraphMonthRangePicker.tsx'), 'utf8')
const pickerCss = readFileSync(join(dir, '../GraphMonthRangePicker.module.css'), 'utf8')

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to)
}

describe('GraphPage chrome', () => {
  it('keeps title and search in the toolbar and leaves create/merge/concurrency out', () => {
    const toolbar = sliceBetween(src, 'styles.toolbar', 'styles.sideColumn')
    expect(toolbar).toContain("t('graph.title'")
    expect(toolbar).toContain("t('graph.search'")
    expect(toolbar).toContain("t('graph.search_semantic'")
    expect(toolbar).toContain("t('graph.search_text'")
    expect(toolbar).toContain('searchHits')
    expect(src).toContain('applySearchHits')
    expect(src).not.toContain('setSelectedId(hits[0].id)')
    expect(toolbar).toContain('GraphMonthRangePicker')
    expect(toolbar).toContain('trailing=')
    expect(toolbar).toContain("t('graph.global_view'")
    expect(pickerSrc).toContain('trailing?: React.ReactNode')
    expect(pickerSrc).toContain("import { Button, withAppContentOverlay } from '@baishou/ui'")
    expect(pickerSrc).not.toContain('footerGhost')
    expect(pickerSrc).not.toContain('footerPrimary')
    expect(pickerCss).toContain('.cluster {')
    expect(pickerCss).toContain('.clusterTrailing')
    expect(toolbar).not.toContain("t('graph.create_node'")
    expect(toolbar).not.toContain("t('graph.merge_nodes'")
    expect(toolbar).not.toContain("t('graph.extract_concurrency'")
  })

  it('keeps month range and global view out of the canvas panel', () => {
    const canvas = sliceBetween(src, ") : sideMode === 'canvas' ? (", ') : (')
    expect(settingsSrc).toContain("t('graph.focus_depth'")
    expect(settingsSrc).not.toContain("t('graph.view_section'")
    expect(canvas).toContain('GraphCanvasSettingsPanel')
    expect(canvas).not.toContain('GraphMonthRangePicker')
    expect(canvas).not.toContain('clearToGlobal')
    expect(src).toContain('GraphMonthRangePicker')
    expect(src).toContain('clearToGlobal')
  })

  it('mounts extract, create, merge, and identity in the organize rail', () => {
    const organize = sliceBetween(
      src,
      "{sideMode === 'organize' ? (",
      ") : sideMode === 'canvas' ? ("
    )
    expect(organize).toContain("t('graph.process_pending_reextract'")
    expect(organize).toContain("t('graph.extract_concurrency'")
    expect(organize).toContain("t('graph.create_node'")
    expect(organize).toContain("t('graph.merge_nodes'")
    expect(organize).toContain('GraphExtractHelpButton')
    expect(organize).toContain("t('graph.extract_one_action'")
    expect(organize).toContain('runExtractOne')
    expect(organize).toContain("t('graph.profile_section'")
    expect(organize).toContain("t('graph.data_ops'")
    expect(organize).toContain("t('graph.clear_life_action'")
    expect(organize).toContain('clearLifeGraph')
    expect(organize).not.toContain("t('common.dangerous_action'")
    expect(organize).not.toContain('btnDanger')
    expect(organize).not.toContain("t('graph.filter'")
    expect(organize.indexOf("t('graph.profile_section'")).toBeLessThan(
      organize.indexOf("t('graph.process_pending_reextract'")
    )
    expect(organize.indexOf("t('graph.merge_nodes'")).toBeLessThan(
      organize.indexOf("t('graph.data_ops'")
    )
    expect(src).toContain('const [dataSectionOpen, setDataSectionOpen] = useState(false)')
  })

  it('keeps clear-life-graph out of general settings', () => {
    const generalSrc = readFileSync(
      join(dir, '../../settings/components/GeneralSettingsPane.tsx'),
      'utf8'
    )
    expect(generalSrc).not.toContain('ClearLifeGraphDangerSection')
    expect(generalSrc).not.toContain('clearLifeGraph')
  })

  it('closes the search candidate panel after picking a hit', () => {
    const hits = sliceBetween(src, 'styles.searchHits', 'styles.toolbarRight')
    expect(hits).toContain('dismissSearchPanel()')
    expect(src).toContain("if (e.key === 'Escape') dismissSearchPanel()")
    expect(src).toContain('setSearchAttempted(false)')
  })

  it('uses existing node-type colors for selected category chips in the canvas rail', () => {
    const canvas = sliceBetween(src, ") : sideMode === 'canvas' ? (", ') : (')
    expect(canvas).toContain('graphNodeTypeColor')
    expect(canvas).toContain('typeChipActive')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('genderChipActive')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween(src, "{tab === 'pending' && (", "{tab === 'detail' && (")
    expect(pending).toContain("t('graph.approve_selected'")
    expect(pending).toContain("t('graph.reject_selected'")
    expect(pending).toContain("t('graph.approve_all'")
    expect(pending).toContain("t('graph.reject_all'")
    expect(pending).toContain('graphPendingItemKey')
    expect(pending).toContain('<Checkbox')
    expect(pending).toContain('resolveGraphNodeDisplayName')
    expect(pending).not.toContain('edge.fromId.slice')
    expect(pending).not.toContain('edge.toId.slice')
  })

  it('locates pending nodes by selection and pending edges by both endpoints', () => {
    const loc = sliceBetween(src, 'const locatePendingEdge', 'const applyQueueSnapshot')
    expect(src).toContain('locatePendingNode')
    expect(loc).toContain('setHighlightedEdgeIds(new Set([edge.id]))')
    expect(loc).toContain('setLocateIds([from.id, to.id])')
    expect(loc).toContain('setLocalView({ nodes: [from, to], edges: [edge] })')
    expect(src).toContain("'graph.legend_pending_edge'")
  })

  it('keeps isolated nodes on the canvas and uses the switch only for names', () => {
    expect(src).not.toContain('filterGraphIsolatedDisplayNodes')
    expect(settingsSrc).toContain("t('graph.show_isolated_nodes'")
    expect(settingsSrc).toContain('showIsolatedNodes')
    const canvasSrc = readFileSync(join(dir, '../GraphForceCanvas.tsx'), 'utf8')
    expect(canvasSrc).toContain('showIsolatedLabels: appearance.showIsolatedNodes')
  })

  it('auto-starts graph organize without the batch confirm dialog', () => {
    expect(src).toContain('skipConfirm?: boolean')
    expect(src).toContain('void runExtractRef.current(undefined, { skipConfirm: true })')
  })

  it('refreshes shared memory readiness after extract queue settles', () => {
    expect(src).toContain('refreshMemoryReadiness')
    expect(src).toContain('void refreshRef.current().finally')
    expect(src).toContain('extracting={readiness.graphExtracting}')
    expect(src).toContain('organizePipeline={readiness.organizePipeline}')
    const css = readFileSync(join(dir, '../GraphPage.module.css'), 'utf8')
    expect(css).toMatch(/\.chipRow \{[^}]*padding: 10px 20px 12px/)
    expect(css).toMatch(/\.statusBar \{[^}]*padding: 8px 20px 2px/)
    expect(css).not.toMatch(/\.statusBar \{[^}]*border-bottom: 1px solid/)
  })

  it('uses the themed Select for adding relations instead of a native html select', () => {
    expect(src).not.toContain('<select')
    expect(src).toContain('styles.editSelect')
    expect(src).toContain('<Select')
    expect(src).toContain('setAddEdgeType')
  })

  it('should use chrome font tokens in the inspector sidebar', () => {
    const css = readFileSync(join(dir, '../GraphPage.module.css'), 'utf8')
    expect(css).toMatch(/\.side \{[^}]*font-size: var\(--ui-fs-md\)/)
    expect(css).toMatch(/\.detailLabel \{[^}]*font-size: var\(--ui-fs-sm\)/)
    expect(css).toMatch(/\.detailValue \{[^}]*font-size: var\(--ui-fs-md\)/)
    expect(css).not.toMatch(/\.detailLabel \{[^}]*text-transform: uppercase/)
    expect(css).not.toMatch(/\.detailLabel \{[^}]*font-size: 11px/)
  })

  it('should import and render GraphSplitNodeModal when the page mounts', () => {
    expect(src).toContain("import { GraphSplitNodeModal } from './GraphSplitNodeModal'")
    expect(src).toContain('<GraphSplitNodeModal')
  })

  it('should hide the split entry when the selected node is an entry', () => {
    const detail = sliceBetween(src, "{tab === 'detail' && (", 'GraphCreateNodeModal')
    expect(detail).toContain("t('graph.split_node'")
    expect(detail).toContain("selectedNode.nodeType !== 'entry'")
  })

  it('should render discriminator as its own tag instead of concatenating it into the name', () => {
    expect(src).toContain('styles.discriminatorTag')
    expect(src).toContain('selectedNode.discriminator')
    expect(src).not.toContain('${selectedNode.name}${selectedNode.discriminator}')
    expect(src).not.toContain('${selectedNode.name}（${selectedNode.discriminator}')
    expect(src).not.toContain('${selectedNode.name} (${selectedNode.discriminator}')
    expect(src).toContain('{selectedNode.name}')
  })

  it('should warn about ambiguous sources with listAmbiguousSourceRefs when the bare node has leftovers', () => {
    expect(src).toContain('listAmbiguousSourceRefs')
    expect(src).toContain("'graph.ambiguous_sources_hint'")
  })

  it('should import GraphSplitNodeModal controls from @baishou/ui and avoid raw button or input', () => {
    const modalSrc = readFileSync(join(dir, '../GraphSplitNodeModal.tsx'), 'utf8')
    expect(modalSrc).toContain("from '@baishou/ui'")
    expect(modalSrc).toContain('Button')
    expect(modalSrc).toContain('Input')
    expect(modalSrc).toContain('SegmentedControl')
    expect(modalSrc).not.toMatch(/<button[\s>]/)
    expect(modalSrc).not.toMatch(/<input[\s>]/)
  })

  it('should keep new graph split i18n keys in all four locale files', () => {
    const i18nDir = join(dir, '../../../../../../../../packages/shared/src/i18n')
    const keys = [
      'discriminator_label',
      'split_node',
      'split_node_title',
      'split_label',
      'split_keep_bare',
      'split_move_to_new',
      'split_unassigned',
      'split_unassigned_count',
      'split_confirm',
      'register_another_entity',
      'same_name_siblings',
      'revert_split',
      'ambiguous_sources_hint'
    ]
    for (const locale of ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']) {
      const json = readFileSync(join(i18nDir, locale), 'utf8')
      for (const key of keys) {
        expect(json, `${locale} missing ${key}`).toContain(`"${key}"`)
      }
    }
  })
})
