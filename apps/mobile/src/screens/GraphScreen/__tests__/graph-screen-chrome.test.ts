import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

function readSrc(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

const src = readSrc('GraphScreen.tsx')
const canvasTabSrc = readSrc('GraphScreenCanvasTab.tsx')
const detailSrc = readSrc('GraphScreenDetailPane.tsx')
const searchTabSrc = readSrc('GraphScreenSearchTab.tsx')
const reextractTabSrc = readSrc('GraphScreenReextractTab.tsx')
const pendingTabSrc = readSrc('GraphScreenPendingTab.tsx')
const similarTabSrc = readSrc('GraphScreenSimilarTab.tsx')
const settingsSrc = readSrc('GraphScreenSettingsSheet.tsx')
const organizeSrc = readSrc('GraphScreenSettingsOrganize.tsx')
const canvasSettingsSrc = readSrc('GraphScreenSettingsCanvas.tsx')
const overlaysSrc = readSrc('GraphScreenOverlays.tsx')
const extractSrc = readSrc('useGraphScreenExtract.ts')
const searchSrc = readSrc('useGraphScreenSearch.ts')
const modelSrc = readSrc('useGraphScreenModel.ts')
const detailHookSrc = [
  readSrc('useGraphScreenDetail.ts'),
  readSrc('useGraphScreenDetailDelete.ts')
].join('\n')
const settingsHookSrc = readSrc('useGraphScreenSettings.ts')
const webviewSrc = [
  readSrc('GraphForceWebView.tsx'),
  readSrc('graph-force-webview-html.ts'),
  readSrc('graph-force-webview-runtime-setup.ts'),
  readSrc('graph-force-webview-runtime-draw.ts'),
  readSrc('graph-force-webview-runtime-camera.ts'),
  readSrc('graph-force-webview-runtime-input.ts')
].join('\n')
const sameNameListSrc = readSrc('GraphNodeSameNameList.tsx')
const createSheetSrc = readSrc('GraphCreateNodeSheet.tsx')
const splitSheetSrc = readSrc('GraphSplitNodeSheet.tsx')
const candidatesUtilSrc = readFileSync(
  join(dir, '../../../services/graph-name-candidates.util.ts'),
  'utf8'
)
const splitServiceSrc = readFileSync(join(dir, '../../../services/mobile-graph-split.ts'), 'utf8')

const pageChrome = [
  src,
  canvasTabSrc,
  detailSrc,
  searchTabSrc,
  reextractTabSrc,
  pendingTabSrc,
  similarTabSrc,
  settingsSrc,
  organizeSrc,
  canvasSettingsSrc,
  overlaysSrc,
  extractSrc,
  searchSrc,
  modelSrc,
  detailHookSrc,
  settingsHookSrc
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

describe('GraphScreen chrome', () => {
  it('should run unified organize from empty graph start button and keep toolbar extract', () => {
    const emptyGuide = sliceBetween(
      canvasTabSrc,
      'props.showEmptyGuide ? (',
      'props.showMonthEmpty ? ('
    )
    expect(emptyGuide).toContain('onStartOrganize')
    expect(emptyGuide).toContain("t('memory.start_organize'")
    expect(emptyGuide).toContain('<Button')
    expect(emptyGuide).not.toContain('estimatedTokens')
    expect(emptyGuide).not.toContain('formatTokens')
    expect(emptyGuide).not.toContain('onRunExtract')
    expect(emptyGuide).not.toContain('runExtract')

    const header = sliceBetween(src, 'headerRight={', 'contentStyle={styles.layoutContent}')
    expect(header).toContain("t('graph.extract', '梳理')")
    expect(header).toContain('extract.runExtract()')

    expect(modelSrc).toContain('startOrganize')
    expect(modelSrc).toContain('batchEmbed')
    expect(src).toContain('onStartOrganize={() => void m.startOrganize()}')
    expect(src).toContain('onRunExtract: () => void extract.runExtract()')
    expect(organizeSrc).toContain("t('graph.process_pending_reextract'")
  })

  it('keeps month, global, and settings on the toolbar and leaves create/merge out', () => {
    const toolbar = sliceBetween(canvasTabSrc, 'styles.toolbarRow', 'renderDepthChips()')
    expect(toolbar).toContain('GraphMonthRangeSheet')
    expect(toolbar).toContain("t('graph.global_view'")
    expect(toolbar).toContain("t('graph.settings'")
    expect(toolbar).not.toContain("t('graph.create_node'")
    expect(toolbar).not.toContain("t('graph.merge_nodes'")
    expect(toolbar).not.toContain("t('graph.extract_concurrency'")
  })

  it('keeps isolated nodes on the canvas and uses the switch only for names', () => {
    expect(pageChrome).not.toContain('filterGraphIsolatedDisplayNodes')
    expect(pageChrome).toContain("t('graph.show_isolated_nodes'")
    expect(pageChrome).toContain('showIsolatedNodes')
    expect(webviewSrc).toContain('appearance.showIsolatedNodes !== false')
    expect(webviewSrc).toContain('ISOLATED_CHARGE_SCALE')
    expect(webviewSrc).toContain('MIXED_CHARGE_SCALE')
    expect(webviewSrc).toContain('ISOLATED_CENTER_SCALE')
    expect(webviewSrc).toContain('ISOLATED_SEED')
    expect(webviewSrc).toContain('VELOCITY_DECAY')
    expect(webviewSrc).toContain('CHARGE_DISTANCE_MAX_MIN')
  })

  it('keeps month range out of the canvas settings section', () => {
    const canvas = sliceBetween(
      embedPane(settingsSrc, '<GraphScreenSettingsCanvas', canvasSettingsSrc),
      "t('graph.side_canvas', '画布')",
      "t('graph.appearance', '外观')"
    )
    expect(canvas).toContain('renderDepthChips()')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('GraphMonthRangeSheet')
    expect(pageChrome).not.toContain("t('graph.view_section'")
  })

  it('mounts extract, create, merge, and identity in the organize settings section', () => {
    const organize = sliceBetween(
      embedPane(settingsSrc, '<GraphScreenSettingsOrganize', organizeSrc),
      "t('graph.side_organize', '整理')",
      "t('graph.side_canvas', '画布')"
    )
    expect(organize).toContain("t('graph.process_pending_reextract'")
    expect(organize).toContain("t('graph.extract_concurrency'")
    expect(organize).toContain("t('graph.create_node'")
    expect(organize).toContain("t('graph.merge_nodes'")
    expect(organize).toContain('GraphExtractHelpButton')
    expect(readSrc('GraphExtractHelpButton.tsx')).toContain('GRAPH_ALIGN_MIN_SIMILARITY_PERCENT')
    expect(organize).toContain("t('graph.extract_one_action'")
    expect(organize).toContain("t('graph.profile_section'")
    expect(organize).toContain("t('graph.data_ops'")
    expect(organize).toContain("t('graph.clear_life_action'")
    expect(organize).not.toContain("t('common.dangerous_action'")
    expect(organize).not.toContain("t('graph.filter'")
    expect(organize.indexOf("t('graph.profile_section'")).toBeLessThan(
      organize.indexOf("t('graph.process_pending_reextract'")
    )
    expect(organize.indexOf("t('graph.merge_nodes'")).toBeLessThan(
      organize.indexOf("t('graph.data_ops'")
    )
    expect(pageChrome).toContain('data: false')
    expect(pageChrome).toContain('runExtractOne')
    expect(pageChrome).toContain('clearLifeGraph')
    expect(pageChrome).toContain('mobileClearLifeGraph')
  })

  it('keeps clear-life-graph out of account settings', () => {
    const accountSrc = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../SettingsScreen/components/SettingsAccountPanel.tsx'
      ),
      'utf8'
    )
    expect(accountSrc).not.toContain('ClearLifeGraphDangerBlock')
    expect(accountSrc).not.toContain('clearLifeGraph')
  })

  it('mounts similar-pending pairs with merge and keep-apart actions', () => {
    const similar = sliceBetween(
      embedPane(src, '<GraphScreenSimilarTab', similarTabSrc),
      "{tab === 'similar' && (",
      "{tab === 'pending' && ("
    )
    expect(modelSrc).toContain("t('graph.tab_similar'")
    expect(similar).toContain("t('graph.similar_empty'")
    expect(similar).toContain("t('graph.similar_merge'")
    expect(similar).toContain("t('graph.similar_keep_apart'")
    expect(similar).toContain('variant="outlined"')
    expect(similar).not.toContain('variant="ghost"')
    expect(src).toContain('mergeSimilarPair(pair.peerId, pair.nodeId')
    expect(src).toContain('dismissSimilarPair(pair.nodeId, pair.peerId)')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween(
      embedPane(
        embedPane(src, '<GraphScreenPendingTab', pendingTabSrc),
        '<GraphScreenOverlays',
        overlaysSrc
      ),
      "{tab === 'pending' && (",
      '<FloatingModal'
    )
    expect(pending).toContain("t('graph.approve_selected'")
    expect(pending).toContain("t('graph.reject_selected'")
    expect(pending).toContain("t('graph.approve_all'")
    expect(pending).toContain("t('graph.reject_all'")
    expect(pending).toContain('graphPendingItemKey')
    expect(pending).toContain('<Checkbox')
    expect(pending).toContain('resolveGraphNodeDisplayName')
    expect(pending).not.toContain('fromId.slice')
    expect(pending).not.toContain('toId.slice')
  })

  it('keeps semantic and text search on the search tab and lists all hits', () => {
    const search = sliceBetween(
      embedPane(
        embedPane(src, '<GraphScreenSearchTab', searchTabSrc),
        '<GraphScreenReextractTab',
        reextractTabSrc
      ),
      "{tab === 'search' && (",
      "{tab === 'reextract' && ("
    )
    expect(search).toContain("t('graph.search_semantic'")
    expect(search).toContain("t('graph.search_text'")
    expect(pageChrome).toContain('applySearchHits')
    expect(pageChrome).toContain('mode: nextMode')
    expect(pageChrome).not.toContain("setTab('graph')\n      setSelectedId(hit.id)")
  })

  it('locates pending nodes by selection and pending edges by both endpoints', () => {
    const loc = sliceBetween(searchSrc, 'const locatePendingEdge', 'const onSearch')
    expect(pageChrome).toContain('locatePendingNode')
    expect(loc).toContain('setHighlightedEdgeIds(new Set([edge.id]))')
    expect(loc).toContain('setLocateIds([from.id, to.id])')
    expect(loc).toContain('setLocalView({ nodes: [from, to], edges: [edge] })')
    expect(loc).toContain("setTab('graph')")
  })

  it('fits the camera to locateIds after WebView reload', () => {
    expect(webviewSrc).toContain('function cameraFitIds()')
    expect(webviewSrc).toContain('highlightEdgeIds')
    expect(webviewSrc).toContain('(locateIdsRef.current?.length ?? 0) > 0')
    expect(webviewSrc).not.toContain('cameraTargetForSelected')
  })

  it('should render discriminator as its own label when a node has been split', () => {
    expect(pageChrome).toContain('GraphDiscriminatorLabel')
    expect(pageChrome).toContain('discriminator: n.discriminator')
    expect(pageChrome).not.toContain('`${selectedNode.name}')
    expect(pageChrome).not.toContain("selectedNode.name + ' ('")
    expect(pageChrome).not.toContain('n.name + n.discriminator')
    expect(webviewSrc).toContain('n.discriminator')
    expect(webviewSrc).toContain('fillText(n.name.slice')
    expect(webviewSrc).not.toContain('n.name + n.discriminator')
    expect(webviewSrc).not.toContain("n.name + '('")
  })

  it('should list registered same-name entities in node detail when the name has been split', () => {
    expect(pageChrome).toContain('GraphNodeSameNameList')
    expect(pageChrome).toContain('mobileListNameCandidates')
    expect(candidatesUtilSrc).toContain('readGraphNameRegistry')
    expect(sameNameListSrc).toContain("t('graph.same_name_siblings'")
    expect(sameNameListSrc).toContain("t('graph.discriminator_label'")
    expect(sameNameListSrc).toContain('onOpen')
    expect(sameNameListSrc).toContain('onRevertSplit')
    expect(overlaysSrc).toContain("t('graph.source_excerpt_label'")
    expect(settingsHookSrc).toContain('saveGraphAppearanceSettings')
    expect(sameNameListSrc).not.toContain('${entity.name}')
    expect(sameNameListSrc).not.toContain("entity.name + ' ('")
  })

  it('should import and render GraphSplitNodeSheet when the screen mounts', () => {
    expect(pageChrome).toContain("import { GraphSplitNodeSheet } from './GraphSplitNodeSheet'")
    expect(pageChrome).toContain('<GraphSplitNodeSheet')
    expect(pageChrome).toContain('mobileRevertGraphNodeSplit')
  })

  it('should hide the split entry when the selected node is an entry', () => {
    expect(pageChrome).toContain("t('graph.split_node'")
    expect(pageChrome).toContain("selectedNode.nodeType !== 'entry'")
    expect(pageChrome).toContain("t('graph.revert_split'")
  })

  it('should show the persisted suspect reason and leftover ambiguous sources', () => {
    expect(pageChrome).toContain('readGraphNodeSuspectReason')
    expect(pageChrome).toContain("t('graph.suspect_reason'")
    expect(pageChrome).toContain("'graph.suspect_badge'")
    expect(pageChrome).toContain("'graph.suspect_pending_hint'")
    expect(modelSrc).toContain('consumeGraphPendingFocus')
    expect(modelSrc).toContain('subscribeGraphPendingFocus')
    expect(pageChrome).toContain('listAmbiguousSourceRefs')
    expect(pageChrome).toContain("t('graph.ambiguous_sources_hint'")
    expect(candidatesUtilSrc).toContain('readGraphNodeSuspectReason')
  })

  it('should import GraphSplitNodeSheet controls from @baishou/ui/native and avoid raw text inputs', () => {
    expect(splitSheetSrc).toContain("from '@baishou/ui/native'")
    expect(splitSheetSrc).toContain('Button')
    expect(splitSheetSrc).toContain('Input')
    expect(splitSheetSrc).toContain('SegmentedControl')
    expect(splitSheetSrc).toContain('Pagination')
    expect(splitSheetSrc).not.toMatch(/<TextInput[\s>]/)
  })

  it('should name original vs new person in split options and paginate the relation list', () => {
    expect(splitSheetSrc).toContain('sliceGraphSplitEdges')
    expect(splitSheetSrc).toContain('graphSplitNewDisplayName')
    expect(splitSheetSrc).toContain('formatGraphSplitPartnerName')
    expect(splitSheetSrc).toContain("t('graph.split_edges_heading'")
    expect(splitSheetSrc).toContain("t('graph.split_discriminator'")
    expect(splitSheetSrc).toContain("t('graph.discriminator_placeholder'")
    expect(splitSheetSrc).toContain("t('graph.split_label_placeholder'")
    expect(splitSheetSrc).toContain("t('graph.split_summary'")
    expect(splitSheetSrc).toContain("t('graph.split_keep_bare'")
    expect(splitSheetSrc).toContain('name:')
  })

  it('should let the user approve a suspect from the split sheet', () => {
    expect(splitSheetSrc).toContain('onApprove')
    expect(splitSheetSrc).toContain("t('graph.clear_suspect'")
    expect(pageChrome).toContain('canApprove={canApproveGraphNode')
    expect(src).toContain('graphSuspectReviewCopy')
    expect(src).toContain('copy.doneKey')
    expect(src).toContain('showSuccess')
    expect(detailSrc).toContain('graphSuspectReviewCopy')
  })

  it('should close the split sheet after a successful save even when leftover relations remain', () => {
    expect(splitSheetSrc).toContain('shouldCloseGraphSplitAfterSave')
    expect(splitSheetSrc).toContain("t('graph.split_saving'")
    expect(splitSheetSrc).not.toContain('if (result.unassignedEdgeIds.length === 0)')
  })

  it('should let create-node register another entity via mobileSplitGraphNode', () => {
    expect(createSheetSrc).toContain("t('graph.register_another_entity'")
    expect(createSheetSrc).toContain('mobileSplitGraphNode')
    expect(createSheetSrc).toContain("from '@baishou/ui/native'")
    expect(createSheetSrc).toContain('Input')
    expect(createSheetSrc).toContain('Button')
    expect(createSheetSrc).toContain("t('graph.label_aliases'")
  })

  it('should keep new graph split i18n keys in all four locale files', () => {
    const i18nDir = join(dir, '../../../../../../packages/shared/src/i18n')
    const keys = [
      'discriminator_label',
      'split_discriminator',
      'discriminator_placeholder',
      'split_node',
      'split_node_title',
      'split_label',
      'split_label_placeholder',
      'split_summary',
      'split_edges_heading',
      'split_keep_bare',
      'split_move_to_new',
      'split_unassigned',
      'split_unassigned_count',
      'split_confirm',
      'split_saving',
      'split_failed',
      'split_not_ready',
      'register_another_entity',
      'same_name_siblings',
      'revert_split',
      'ambiguous_sources_hint',
      'suspect_reason',
      'suspect_badge',
      'clear_suspect',
      'clear_suspect_done',
      'suspect_pending_hint',
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

  it('should wrap split and revert through mobile-graph-split instead of calling core directly from the screen', () => {
    expect(splitServiceSrc).toContain('export async function mobileSplitGraphNode')
    expect(splitServiceSrc).toContain('export async function mobileRevertGraphNodeSplit')
    expect(splitServiceSrc).toContain('export function toMobileNameCandidate')
    expect(src).not.toContain("from '@baishou/core-mobile'")
    expect(pageChrome).not.toContain("from '@baishou/core-mobile'")
    expect(pageChrome).toContain("from '@/src/services/mobile-graph-split'")
  })

  it('should sync split writes without waiting on a full orphan sweep', () => {
    const from = splitServiceSrc.indexOf('export async function mobileSplitGraphNode')
    const to = splitServiceSrc.indexOf('export async function mobileRevertGraphNodeSplit')
    const split = splitServiceSrc.slice(from, to)
    expect(split).toContain('syncMobileGraphPendingIndex')
    expect(split).toContain("absentSweep: 'off'")
  })
})
