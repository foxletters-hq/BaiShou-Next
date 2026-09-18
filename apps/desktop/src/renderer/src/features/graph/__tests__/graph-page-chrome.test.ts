import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

function readSrc(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

const src = readSrc('GraphPage.tsx')
const toolbarSrc = readSrc('GraphPageToolbar.tsx')
const organizeSrc = readSrc('GraphPageOrganizePane.tsx')
const canvasPaneSrc = readSrc('GraphPageCanvasPane.tsx')
const pendingSrc = readSrc('GraphPagePendingPane.tsx')
const similarSrc = readSrc('GraphPageSimilarPane.tsx')
const detailSrc = readSrc('GraphPageDetailPane.tsx')
const contentSrc = readSrc('GraphPageContentPane.tsx')
const sideSrc = readSrc('GraphPageSideColumn.tsx')
const canvasStageSrc = readSrc('GraphPageCanvasStage.tsx')
const overlaysSrc = readSrc('GraphPageOverlays.tsx')
const extractSrc = readSrc('useGraphPageExtract.ts')
const searchSrc = readSrc('useGraphPageSearch.ts')
const selectionSrc = readSrc('useGraphPageSelection.ts')
const modelSrc = readSrc('useGraphPageModel.ts')
const settingsSrc = readSrc('GraphCanvasSettingsPanel.tsx')
const pickerSrc = readSrc('GraphMonthRangePicker.tsx')
const pickerCss = readFileSync(join(dir, '../GraphMonthRangePicker.module.css'), 'utf8')

const pageChrome = [
  src,
  toolbarSrc,
  organizeSrc,
  canvasPaneSrc,
  contentSrc,
  pendingSrc,
  similarSrc,
  detailSrc,
  sideSrc,
  canvasStageSrc,
  overlaysSrc,
  extractSrc,
  searchSrc,
  selectionSrc,
  modelSrc
].join('\n')

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to)
}

function embedPane(host: string, tag: string, pane: string): string {
  expect(host).toContain(tag)
  return host.replace(tag, `${pane}\n${tag}`)
}

describe('GraphPage chrome', () => {
  it('keeps title and search in the toolbar and leaves create/merge/concurrency out', () => {
    const toolbar = sliceBetween(`${toolbarSrc}\n${sideSrc}`, 'styles.toolbar', 'styles.sideColumn')
    expect(toolbar).toContain("t('graph.title'")
    expect(toolbar).toContain("t('graph.search'")
    expect(toolbar).toContain("t('graph.search_semantic'")
    expect(toolbar).toContain("t('graph.search_text'")
    expect(toolbar).toContain('searchHits')
    expect(searchSrc).toContain('applySearchHits')
    expect(searchSrc).not.toContain('setSelectedId(hits[0].id)')
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
    const canvas = sliceBetween(
      embedPane(sideSrc, '<GraphPageCanvasPane', canvasPaneSrc),
      ") : sideMode === 'canvas' ? (",
      ') : ('
    )
    expect(settingsSrc).toContain("t('graph.focus_depth'")
    expect(settingsSrc).not.toContain("t('graph.view_section'")
    expect(canvas).toContain('GraphCanvasSettingsPanel')
    expect(canvas).not.toContain('GraphMonthRangePicker')
    expect(canvas).not.toContain('clearToGlobal')
    expect(pageChrome).toContain('GraphMonthRangePicker')
    expect(pageChrome).toContain('clearToGlobal')
  })

  it('mounts extract, create, merge, and identity in the organize rail', () => {
    const organize = sliceBetween(
      embedPane(sideSrc, '<GraphPageOrganizePane', organizeSrc),
      "{sideMode === 'organize' ? (",
      ") : sideMode === 'canvas' ? ("
    )
    expect(organize).toContain("t('graph.process_pending_reextract'")
    expect(organize).toContain("t('graph.extract_concurrency'")
    expect(organize).toContain("t('graph.create_node'")
    expect(organize).toContain("t('graph.merge_nodes'")
    expect(organize).toContain('GraphExtractHelpButton')
    expect(organize).toContain("t('graph.extract_one_action'")
    expect(organize).toContain('onRunExtractOne')
    expect(pageChrome).toContain('runExtractOne')
    expect(organize).toContain("t('graph.profile_section'")
    expect(organize).toContain("t('graph.data_ops'")
    expect(organize).toContain("t('graph.clear_life_action'")
    expect(organize).toContain('onClearLifeGraph')
    expect(pageChrome).toContain('clearLifeGraph')
    expect(organize).not.toContain("t('common.dangerous_action'")
    expect(organize).not.toContain('btnDanger')
    expect(organize).not.toContain("t('graph.filter'")
    expect(organize.indexOf("t('graph.profile_section'")).toBeLessThan(
      organize.indexOf("t('graph.process_pending_reextract'")
    )
    expect(organize.indexOf("t('graph.merge_nodes'")).toBeLessThan(
      organize.indexOf("t('graph.data_ops'")
    )
    expect(organizeSrc).toContain('const [dataSectionOpen, setDataSectionOpen] = useState(false)')
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
    const hits = sliceBetween(toolbarSrc, 'styles.searchHits', 'styles.toolbarRight')
    expect(hits).toContain('dismissSearchPanel()')
    expect(searchSrc).toContain("if (event.key === 'Escape') dismissSearchPanel()")
    expect(toolbarSrc).toContain("if (e.key === 'Escape') props.dismissSearchPanel()")
    expect(searchSrc).toContain('setSearchAttempted(false)')
  })

  it('uses existing node-type colors for selected category chips in the canvas rail', () => {
    const canvas = sliceBetween(
      embedPane(sideSrc, '<GraphPageCanvasPane', canvasPaneSrc),
      ") : sideMode === 'canvas' ? (",
      ') : ('
    )
    expect(canvas).toContain('graphNodeTypeColor')
    expect(canvas).toContain('typeChipActive')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('genderChipActive')
  })

  it('mounts similar-pending pairs with merge and keep-apart actions', () => {
    const similar = sliceBetween(
      embedPane(contentSrc, '<GraphPageSimilarPane', similarSrc),
      "{tab === 'similar' &&",
      "{tab === 'detail' &&"
    )
    expect(contentSrc).toContain("t('graph.tab_similar_count'")
    expect(similar).toContain("t('graph.similar_empty'")
    expect(similar).toContain("t('graph.similar_merge'")
    expect(similar).toContain("t('graph.similar_keep_apart'")
    expect(similar).toContain('variant="outlined"')
    expect(similar).not.toContain('variant="ghost"')
    expect(src).toContain('mergeNodes(pair.peerId, pair.nodeId)')
    expect(src).toContain('dismissSimilarPair(pair.nodeId, pair.peerId)')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween(
      embedPane(contentSrc, '<GraphPagePendingPane', pendingSrc),
      "{tab === 'pending' &&",
      "{tab === 'detail' &&"
    )
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
    const loc = sliceBetween(
      selectionSrc,
      'const locatePendingEdge',
      'const refreshVisibleAfterReview'
    )
    expect(selectionSrc).toContain('locatePendingNode')
    expect(loc).toContain('setHighlightedEdgeIds(new Set([edge.id]))')
    expect(loc).toContain('setLocateIds([from.id, to.id])')
    expect(loc).toContain('setLocalView({ nodes: [from, to], edges: [edge] })')
    expect(canvasStageSrc).toContain("'graph.legend_pending_edge'")
  })

  it('keeps isolated nodes on the canvas and uses the switch only for names', () => {
    expect(pageChrome).not.toContain('filterGraphIsolatedDisplayNodes')
    expect(settingsSrc).toContain("t('graph.show_isolated_nodes'")
    expect(settingsSrc).toContain('showIsolatedNodes')
    const canvasDrawSrc = readSrc('graph-force-canvas-draw.ts')
    expect(canvasDrawSrc).toContain('showIsolatedLabels: appearance.showIsolatedNodes')
  })

  it('auto-starts graph organize without the batch confirm dialog', () => {
    expect(extractSrc).toContain('skipConfirm?: boolean')
    expect(extractSrc).toContain('void runExtractRef.current(undefined, { skipConfirm: true })')
  })

  it('refreshes shared memory readiness after extract queue settles', () => {
    expect(extractSrc).toContain('refreshMemoryReadiness')
    expect(extractSrc).toContain('void d.refreshRef.current().finally')
    expect(src).toContain('extracting={readiness.graphExtracting}')
    expect(src).toContain('organizePipeline={readiness.organizePipeline}')
    const css = readFileSync(join(dir, '../GraphPage.module.css'), 'utf8')
    expect(css).toMatch(/\.chipRow \{[^}]*padding: 10px 20px 12px/)
    expect(css).toMatch(/\.statusBar \{[^}]*padding: 8px 20px 2px/)
    expect(css).not.toMatch(/\.statusBar \{[^}]*border-bottom: 1px solid/)
  })

  it('uses the themed Select for adding relations instead of a native html select', () => {
    expect(pageChrome).not.toContain('<select')
    expect(detailSrc).toContain('styles.editSelect')
    expect(detailSrc).toContain('<Select')
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
    expect(overlaysSrc).toContain("import { GraphSplitNodeModal } from './GraphSplitNodeModal'")
    expect(overlaysSrc).toContain('<GraphSplitNodeModal')
    expect(src).toContain('<GraphPageOverlays')
  })

  it('should hide the split entry when the selected node is an entry', () => {
    const detail = sliceBetween(
      `${embedPane(contentSrc, '<GraphPageDetailPane', detailSrc)}\n${overlaysSrc}`,
      "{tab === 'detail' &&",
      'GraphCreateNodeModal'
    )
    expect(detail).toContain("t('graph.split_node'")
    expect(detail).toContain("selectedNode.nodeType !== 'entry'")
  })

  it('should render discriminator as its own tag instead of concatenating it into the name', () => {
    expect(detailSrc).toContain('styles.discriminatorTag')
    expect(detailSrc).toContain('selectedNode.discriminator')
    expect(detailSrc).not.toContain('${selectedNode.name}${selectedNode.discriminator}')
    expect(detailSrc).not.toContain('${selectedNode.name}（${selectedNode.discriminator}')
    expect(detailSrc).not.toContain('${selectedNode.name} (${selectedNode.discriminator}')
    expect(detailSrc).toContain('{selectedNode.name}')
  })

  it('should warn about ambiguous sources with listAmbiguousSourceRefs when the bare node has leftovers', () => {
    expect(detailSrc).toContain('listAmbiguousSourceRefs')
    expect(detailSrc).toContain("'graph.ambiguous_sources_hint'")
  })

  it('should show the persisted suspect reason on the selected node', () => {
    expect(detailSrc).toContain('readGraphNodeSuspectReason')
    expect(detailSrc).toContain("'graph.suspect_reason'")
  })

  it('should import GraphSplitNodeModal controls from @baishou/ui and avoid raw button or input', () => {
    const modalSrc = readSrc('GraphSplitNodeModal.tsx')
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
      'ambiguous_sources_hint',
      'suspect_reason',
      'tab_similar',
      'tab_similar_count',
      'similar_empty',
      'similar_hint',
      'similar_merge',
      'similar_keep_apart',
      'similar_dismissed'
    ]
    for (const locale of ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']) {
      const json = readFileSync(join(i18nDir, locale), 'utf8')
      for (const key of keys) {
        expect(json, `${locale} missing ${key}`).toContain(`"${key}"`)
      }
    }
  })
})
