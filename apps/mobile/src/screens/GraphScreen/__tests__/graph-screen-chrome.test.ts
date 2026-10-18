import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

function readSrc(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

const src = readSrc('GraphScreen.tsx')
const embeddedSrc = readSrc('GraphScreenEmbeddedPane.tsx')
const canvasPaneSrc = readSrc('GraphScreenCanvasPane.tsx')
const monthSheetSrc = readSrc('GraphMonthRangeSheet.tsx')
const canvasSrc = readSrc('GraphCanvasScreen.tsx')
const noticeSrc = readSrc('GraphDesktopOnlyNotice.tsx')
const canvasModelSrc = readSrc('useGraphCanvasModel.ts')
const emptyGuideSrc = readSrc('GraphScreenEmptyGuide.tsx')
const awakenSrc = readSrc('GraphAwakenWelcome.tsx')
const peekSrc = readSrc('GraphCanvasNodePeek.tsx')
const detailSrc = readSrc('GraphScreenDetailPane.tsx')
const nodeScreenSrc = readSrc('GraphNodeScreen.tsx')
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
  readSrc('graph-force-webview.util.ts'),
  readSrc('graph-force-webview-runtime-setup.ts'),
  readSrc('graph-force-webview-runtime-physics.ts'),
  readSrc('graph-force-webview-runtime-gl.ts'),
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
  embeddedSrc,
  canvasPaneSrc,
  monthSheetSrc,
  canvasSrc,
  canvasModelSrc,
  emptyGuideSrc,
  peekSrc,
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
    expect(emptyGuideSrc).toContain('onStartOrganize')
    expect(emptyGuideSrc).toContain("t('memory.start_organize'")
    expect(emptyGuideSrc).toContain('size="sm"')
    expect(emptyGuideSrc).toContain('<Button')
    expect(emptyGuideSrc).not.toContain('estimatedTokens')
    expect(emptyGuideSrc).not.toContain('formatTokens')
    expect(emptyGuideSrc).not.toContain('onRunExtract')
    expect(emptyGuideSrc).not.toContain('runExtract')

    const header = sliceBetween(src, 'headerRight={', 'contentStyle={styles.layoutContent}')
    expect(header).toContain("t('graph.extract', '梳理')")
    expect(header).toContain('extract.runExtract()')

    expect(extractSrc).toContain('const tRef = useRef(deps.t)')
    expect(modelSrc).toContain('const translate: GraphScreenTranslateFn = useCallback')
    expect(modelSrc).toContain('data.refreshRef.current()')
    expect(modelSrc).not.toContain('void data.refresh().catch')
    expect(src).toContain('onStartOrganize={() => void m.startOrganize()}')
    expect(src).toContain('onRunExtract: () => void extract.runExtract()')
    expect(organizeSrc).not.toContain("t('graph.process_pending_reextract'")
  })

  it('should open graph node review as a stack page like knowledge notebook review', () => {
    const reviewPage = readSrc('GraphReviewScreen.tsx')
    expect(reviewPage).toContain('StackScreenLayout')
    expect(reviewPage).toContain("t('graph.node_review_title', '整理节点')")
    expect(reviewPage).toContain('SegmentedControl')
    expect(reviewPage).toContain("t('graph.tab_pending_count'")
    expect(reviewPage).toContain("t('graph.tab_similar_count'")
    expect(reviewPage).toContain('GraphScreenPendingTab')
    expect(reviewPage).toContain('GraphScreenSimilarTab')
    expect(reviewPage).toContain('GraphScreenReextractTab')
    expect(reviewPage).toContain('resolveGraphReviewOverlayTab')
    expect(src).toContain("router.push('/graph-review')")
    expect(src).not.toContain('opsOverlay')
    expect(src).not.toContain('setOpsOverlay')
  })

  it('should keep review and search sections and display relation graph below in embedded mode', () => {
    expect(embeddedSrc).toContain('reviewAndSearch')
    expect(embeddedSrc).toContain('KeyboardAwareScrollView')
    expect(embeddedSrc).toContain('GraphScreenCanvasPane')
    expect(embeddedSrc).toContain('tokens.spacing.xl * 18')
    expect(embeddedSrc).toContain("props.viewMode === 'list'")
    expect(embeddedSrc).toContain("props.viewMode === 'graph'")
    expect(embeddedSrc).toMatch(
      /\{reviewAndSearch\}[\s\S]*<SegmentedContent[\s\S]*props\.viewMode === 'list'[\s\S]*props\.viewMode === 'graph'/
    )
  })

  it('should keep the month trigger on the surface color and give months more room than years', () => {
    expect(monthSheetSrc).toContain('backgroundColor: colors.bgSurface')
    expect(monthSheetSrc).toContain('width: sharedTokens.spacing.xxl')
    expect(monthSheetSrc).toContain("width: '31%'")
    expect(monthSheetSrc).not.toContain('flexGrow: 1')
  })

  it('should surface review queues as one status button when embedded', () => {
    expect(src).toContain('embedded')
    expect(src).toContain('onUnifiedOrganize')
    expect(src).toContain('GraphScreenEmbeddedPane')
    expect(src).toContain('onOpenReview={() => openReview()}')
    expect(src).toContain("router.push('/graph-review')")
    expect(readSrc('GraphReviewScreen.tsx')).toContain('search.locatePendingEdge')
    expect(src).toContain('{content}')
    expect(src).not.toContain('GraphScreenEmbeddedCanvas')
    expect(src).not.toContain('reviewActions')
    expect(src).toContain("mode={embedded ? 'canvas' : 'organize'}")
    expect(src).toContain('onOpenSettings')
    expect(modelSrc).toContain('onUnifiedOrganize')
    expect(modelSrc).toContain('options?.onUnifiedOrganize')
    const reviewSection = readSrc('GraphScreenReviewActionsSection.tsx')
    expect(reviewSection).toContain("from '@baishou/ui/native'")
    expect(reviewSection).toContain('Card')
    expect(reviewSection).toContain('<Button')
    expect(reviewSection).toContain('variant="outlined"')
    expect(reviewSection).toContain('size="sm"')
    expect(reviewSection).toContain("t('graph.node_review_status'")
    expect(reviewSection).toContain("t('graph.node_review_needed'")
    expect(reviewSection).toContain("t('graph.node_review_open_hint'")
    expect(reviewSection).toContain('onOpenReview')
    expect(reviewSection).not.toContain('GraphForceWebView')
    expect(reviewSection).not.toContain("t('graph.settings', '设置')")
    expect(src).toContain("disabled={embedded && m.phaseKey === 'main'}")
    expect(modelSrc).not.toContain('options?.allMonths')
    expect(settingsSrc).not.toContain('reviewActions')
    expect(settingsSrc).not.toContain("t('graph.tab_pending_count'")
  })

  it('should expose desktop organize operations on the embedded graph page without canvas node tools', () => {
    expect(src).toContain('organize={{')
    expect(settingsSrc).toContain('GraphScreenSettingsOrganize')
    expect(embeddedSrc).toContain('GraphScreenSearchSection')
    expect(embeddedSrc).toContain('KeyboardAwareScrollView')
    expect(src).toContain('detail.setCreateOpen(true)')
    expect(src).toContain('review.setMergeSearchOpen(true)')
    expect(src).toContain('setNodeDetailOpen(true)')
    expect(src).toContain('canvas={')
    expect(settingsSrc).toContain('GraphScreenSettingsCanvas')
    const organizeSection = readSrc('GraphScreenOrganizeSection.tsx')
    expect(organizeSection).toContain("from '@baishou/ui/native'")
    expect(organizeSection).toContain('Card')
    expect(organizeSection).toContain('<Button')
    expect(organizeSection).toContain('variant="outlined"')
    expect(organizeSection).toContain('size="sm"')
    expect(organizeSection).toContain('Input')
    expect(organizeSection).toContain('<Select')
    expect(organizeSection).toContain('SettingsSliderRow')
    expect(organizeSection).toContain('titleAddon')
    expect(organizeSection).toContain('DatePickerFloatingModal')
    expect(organizeSection).toContain('HelpTooltip')
    expect(organizeSection).toContain("t('graph.create_node'")
    expect(organizeSection).toContain("t('graph.merge_nodes'")
    expect(organizeSection).toContain("t('graph.process_pending_reextract'")
    expect(organizeSection).toContain("t('graph.extract_one_action'")
    expect(organizeSection).toContain('styles.fieldActionRow')
    expect(organizeSection).toContain('styles.fieldControlGrow')
    expect(organizeSection).toContain("t('graph.extract_concurrency'")
    expect(organizeSection).toContain("t('graph.profile_section'")
    expect(organizeSection).toContain("t('graph.clear_life_action'")
    expect(organizeSection).not.toContain("t('graph.filter'")
    expect(organizeSection).not.toContain('GraphForceWebView')
    const searchSection = readSrc('GraphScreenSearchSection.tsx')
    expect(searchSection).toContain('SegmentedControl')
    expect(searchSection).toContain('Input')
    expect(searchSection).toContain("t('graph.search'")
    expect(searchSection).toContain("t('common.search'")
    expect(searchSection).toContain("t('graph.searching'")
    expect(searchSection).toContain('hideList')
    expect(searchSection).toContain("t('graph.view_list'")
    expect(searchSection).toContain("t('graph.view_graph'")
    expect(searchSection).toContain("t('graph.view_mode'")
    expect(searchSection).toContain('size="small"')
    expect(embeddedSrc).toContain('search.searching')
    expect(src).toContain('setNodeDetailOpen(true)')
  })

  it('should use mobile typography roles on the embedded graph sections', () => {
    const sectionStyles = readSrc('graph-screen-section.styles.ts')
    expect(sectionStyles).toContain('mobileTypography.title')
    expect(sectionStyles).toContain('mobileTypography.primary')
    expect(sectionStyles).toContain('mobileTypography.secondary')
    expect(sectionStyles).toContain('mobileTypography.caption')
    expect(sectionStyles).toContain('searchBox')
    expect(sectionStyles).toContain('compactFieldHeight')
    const reviewSection = readSrc('GraphScreenReviewActionsSection.tsx')
    const searchSection = readSrc('GraphScreenSearchSection.tsx')
    const organizeSection = readSrc('GraphScreenOrganizeSection.tsx')
    expect(reviewSection).toContain('graphScreenSectionStyles')
    expect(searchSection).toContain('graphScreenSectionStyles')
    expect(organizeSection).toContain('graphScreenSectionStyles')
    expect(reviewSection).toContain('styles.hint')
    expect(searchSection).toContain('styles.title')
    expect(organizeSection).toContain('styles.title')
    expect(searchSection).toContain('styles.hint')
    expect(searchSection).toContain('size="small"')
    expect(searchSection).toContain('stretch={false}')
    expect(searchSection).toContain('styles.searchBox')
    expect(searchSection).toContain('bare')
    expect(searchSection).not.toContain('mobileTypography.caption')
    expect(organizeSection).toContain('styles.row')
    expect(organizeSection).toContain('styles.hint')
    expect(organizeSection).toContain('styles.fieldControl')
    expect(organizeSection).toContain('styles.fieldText')
    expect(organizeSection).not.toContain('titleStyle')
    expect(organizeSection).not.toContain('labelStyle')
  })

  it('should use outlined native buttons on the awaken welcome actions', () => {
    expect(awakenSrc).toContain("from '@baishou/ui/native'")
    expect(awakenSrc).toContain('Button')
    expect(awakenSrc).toContain('variant="outlined"')
    expect(awakenSrc).toContain("t('graph.awaken_welcome_cta'")
    expect(awakenSrc).toContain("t('graph.awaken_submit'")
    expect(awakenSrc).toContain("t('graph.awaken_back'")
    expect(awakenSrc).toContain('colors.borderControl')
    expect(awakenSrc).not.toContain("backgroundColor: 'transparent'")
    expect(awakenSrc).not.toContain('styles.cta')
  })

  it('should keep awaken actions gender chips and fields on the same small outlined chrome', () => {
    const buttonCount = awakenSrc.match(/<Button\b/g)?.length ?? 0
    const smCount = awakenSrc.match(/size="sm"/g)?.length ?? 0
    expect(buttonCount).toBe(3)
    expect(smCount).toBe(buttonCount)
    expect(awakenSrc).toContain('Input')
    expect(awakenSrc).toContain('<Select')
    expect(awakenSrc).toContain('variant="settings"')
    expect(awakenSrc).toContain("justifyContent: 'space-between'")
    expect(awakenSrc).not.toContain('genderRow')
    expect(awakenSrc).not.toContain('TextInput')
    expect(awakenSrc).not.toContain('borderRadius: 999')
    expect(awakenSrc).not.toContain("fontWeight: '700'")
    expect(awakenSrc).toContain('mobileTypography.title.fontSize')
    expect(awakenSrc).toContain('mobileTypography.primary')
    expect(awakenSrc).toContain('tokens.radius.md')
    expect(awakenSrc).toContain('minHeight: 40')
    expect(awakenSrc).not.toContain('borderRadius: 8')
    expect(awakenSrc).not.toContain('minHeight: 48')
    expect(awakenSrc).toContain('bare')
    expect(awakenSrc).toContain('triggerStyle')
    expect(awakenSrc).toContain('mobileTypography.body.fontSize')
    expect(awakenSrc).toContain('styles.fieldControl')
    expect(awakenSrc).toContain('chevron="▼"')
    expect(awakenSrc).toContain('const minBirthday')
    expect(awakenSrc).toContain('const maxBirthday')
    expect(awakenSrc).not.toContain('fontSize: 20')
    expect(awakenSrc).not.toContain('uiTypography.xl')
  })

  it('should wash the awaken page with a soft primary glow and lift content toward full-screen center', () => {
    expect(awakenSrc).toContain('RadialGradient')
    expect(awakenSrc).toContain('colors.primary')
    expect(awakenSrc).toContain('paddingTop: sharedTokens.spacing.mdTight')
    expect(awakenSrc).toContain('paddingBottom: 88')
    expect(awakenSrc).not.toContain('paddingVertical: 40')
  })

  it('should keep hub tabs without a dedicated graph tab and mount canvas only in the embedded display pane', () => {
    expect(src).toContain("t('graph.side_organize'")
    expect(src).toContain('size="sm"')
    expect(src).not.toContain("t('graph.open_canvas'")
    expect(src).not.toContain("router.push('/graph-view')")
    expect(src).not.toContain('requestGraphCanvasLocate')
    expect(src).not.toContain('GraphForceWebView')
    expect(src).toContain('<GraphScreenDetailPane')
    expect(src).toContain("mode={embedded ? 'canvas' : 'organize'}")
    expect(modelSrc).toContain("['search'")
    expect(modelSrc).not.toContain("['graph', t('graph.tab_graph'")
    expect(canvasSrc).toContain('GraphDesktopOnlyNotice')
    expect(canvasSrc).not.toContain('GraphForceWebView')
    expect(canvasSrc).not.toContain('GraphScreenDetailPane')
    expect(peekSrc).toContain("t('graph.open_node_detail'")
    expect(searchSrc).not.toContain("setTab('graph')")
    expect(embeddedSrc).toContain('GraphScreenCanvasPane')
    expect(embeddedSrc).toContain('viewMode={props.viewMode}')
    expect(canvasPaneSrc).toContain('GraphForceWebView')
    expect(canvasPaneSrc).toContain('GraphMonthRangeSheet')
    expect(canvasPaneSrc).toContain("t('graph.settings', '设置')")
    expect(monthSheetSrc).toContain("t('graph.month_range_all'")
    expect(monthSheetSrc).toContain('allGraphMonthRange')
  })

  it('should center a compact month trigger and open the range sheet without a fade or empty-state shortcuts', () => {
    expect(monthSheetSrc).toContain("textAlign: 'center'")
    expect(monthSheetSrc).toContain("justifyContent: 'center'")
    expect(monthSheetSrc).toContain('graphScreenSectionStyles.fieldControl')
    expect(monthSheetSrc).toContain('animationType="none"')
    expect(monthSheetSrc).toContain('unstable_pressDelay={0}')
    expect(monthSheetSrc).toContain('const openSheet')
    expect(monthSheetSrc).not.toContain('useEffect')
    expect(monthSheetSrc).toContain("t('graph.month_range_recent3'")
    expect(monthSheetSrc).toContain("t('graph.month_range_all'")
    expect(canvasPaneSrc).not.toContain("t('graph.month_range_recent3'")
    expect(canvasPaneSrc).not.toContain("t('graph.month_range_all'")
    expect(canvasPaneSrc).not.toContain('allGraphMonthRange')
    expect(canvasPaneSrc).not.toContain('defaultGraphMonthRange')
  })

  it('should keep the standalone canvas route as a desktop notice', () => {
    expect(canvasSrc).toContain('GraphDesktopOnlyNotice')
    expect(noticeSrc).toContain("'graph.mobile_canvas_paused_title'")
    expect(noticeSrc).toContain("'graph.mobile_canvas_paused_body'")
    expect(canvasSrc).not.toContain('GraphForceWebView')
    expect(canvasSrc).not.toContain('GraphMonthRangeSheet')
    expect(canvasSrc).not.toContain("t('graph.create_node'")
    expect(canvasSrc).not.toContain("t('graph.merge_nodes'")
    expect(canvasSrc).not.toContain("t('graph.extract_concurrency'")
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
    expect(webviewSrc).toContain("getContext('webgl'")
    expect(webviewSrc).toContain('fillChargeGrid')
    expect(webviewSrc).toContain('GRAPH_FORCE_ISOLATED_PAIRWISE_MAX')
    expect(webviewSrc).toContain('GRAPH_FORCE_ISOLATED_GRID_CELL')
    expect(webviewSrc).toContain('gl_PointSize')
    expect(webviewSrc).toContain('id="labels"')
    expect(canvasSettingsSrc).toContain("t('graph.max_nodes'")
    expect(canvasSettingsSrc).toContain("t('graph.max_nodes_unlimited'")
    expect(canvasSettingsSrc).toContain('graphViewMaxNodesSliderValue')
  })

  it('should keep canvas pan from scrolling the host page', () => {
    const touchStart = webviewSrc.slice(
      webviewSrc.indexOf("canvas.addEventListener('touchstart'"),
      webviewSrc.indexOf("canvas.addEventListener('touchmove'")
    )
    const touchMove = webviewSrc.slice(
      webviewSrc.indexOf("canvas.addEventListener('touchmove'"),
      webviewSrc.indexOf("canvas.addEventListener('touchend'")
    )
    expect(touchStart).toContain('ev.preventDefault()')
    expect(touchStart).not.toContain("type:'interact'")
    const pinchBranch = touchMove.slice(0, touchMove.indexOf('const t=ev.touches[0]'))
    expect(pinchBranch).toContain('requestDraw()')
    expect(touchMove).toContain('ev.preventDefault()')
    expect(touchMove).toContain('{passive:false}')
    expect(webviewSrc).toContain("document.addEventListener('touchstart'")
    expect(webviewSrc).toContain('capture:true')
    expect(webviewSrc).not.toContain('{passive:true}')
    expect(readSrc('GraphForceWebView.tsx')).toContain('nestedScrollEnabled={true}')
    expect(readSrc('GraphForceWebView.tsx')).toContain('scalesPageToFit={false}')
    expect(readSrc('GraphForceWebView.tsx')).not.toContain('onInteract')
  })

  it('should freeze the mobile canvas after one static settle when animation is off', () => {
    expect(webviewSrc).toContain('function settleLayout()')
    expect(webviewSrc).toContain('settleLayout();')
    expect(webviewSrc).not.toContain('let simRunning = true')
    expect(webviewSrc).not.toContain('\nloop();\n')
    expect(webviewSrc).not.toContain('if(simRunning){')
    expect(webviewSrc).not.toContain('wakeSim();')
    expect(webviewSrc).toContain('easeCameraTowardSelected({ k: targetK, alpha: 1 })')
  })

  it('should draw small dots, hide most names until zoom, and fit the camera after settle', () => {
    expect(webviewSrc).toContain('GRAPH_MOBILE_NODE_RADIUS_BASE = 3')
    expect(webviewSrc).toContain('NODE_RADIUS_BASE = ${GRAPH_MOBILE_NODE_RADIUS_BASE}')
    expect(webviewSrc).toContain('function shouldShowLabel(')
    expect(webviewSrc).toContain('function fitAllNodes()')
    expect(webviewSrc).toContain('fitAllNodes();')
    expect(webviewSrc).toContain('SETTLE_CENTER_SCALE')
    expect(webviewSrc).toContain('graphMetaFingerprint')
  })

  it('keeps month range out of the canvas settings section', () => {
    const canvas = sliceBetween(
      embedPane(settingsSrc, '<GraphScreenSettingsCanvas', canvasSettingsSrc),
      "t('graph.side_canvas', '画布')",
      "t('graph.appearance', '外观')"
    )
    expect(canvasSettingsSrc).toContain('renderDepthChips()')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('GraphMonthRangeSheet')
    expect(pageChrome).not.toContain("t('graph.view_section'")
  })

  it('mounts extract, create, merge, and identity in the organize settings section', () => {
    const organize = sliceBetween(
      embedPane(settingsSrc, '<GraphScreenSettingsOrganize', organizeSrc),
      "t('graph.side_organize', '整理')",
      "t('common.close', '关闭')"
    )
    expect(organize).not.toContain("t('graph.process_pending_reextract'")
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
      organize.indexOf("t('graph.extract_one_action'")
    )
    expect(organize.indexOf("t('graph.merge_nodes'")).toBeLessThan(
      organize.indexOf("t('graph.data_ops'")
    )
    expect(pageChrome).toContain('data: false')
    expect(pageChrome).toContain('runExtractOne')
    expect(pageChrome).toContain('clearLifeGraph')
    expect(pageChrome).toContain('mobileClearLifeGraph')
    expect(pageChrome).toContain('subscribeGraphDataChanged')
    expect(pageChrome).toContain('stopAndDropPersisted')
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
      "{tab === 'reextract' && ("
    )
    expect(modelSrc).toContain("t('graph.tab_similar'")
    expect(similar).toContain("t('graph.similar_empty'")
    expect(similar).toContain("t('graph.similar_merge'")
    expect(similar).toContain("t('graph.similar_keep_apart'")
    expect(similar).toContain("t('graph.locate', '查看')")
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
      "{tab === 'similar' && ("
    )
    expect(pending).toContain("t('graph.approve_selected'")
    expect(pending).toContain("t('graph.reject_selected'")
    expect(pending).not.toContain("t('graph.approve_all'")
    expect(pending).not.toContain("t('graph.reject_all'")
    expect(pending).toContain('onViewNodeSource')
    expect(pending).toContain('openNodeSource')
    expect(pending).toContain('graphPendingItemKey')
    expect(pending).toContain('<Checkbox')
    expect(pending).toContain('resolveGraphNodeDisplayName')
    expect(pending).not.toContain('fromId.slice')
    expect(pending).not.toContain('toId.slice')
    const reviewSrc = readSrc('useGraphScreenReview.ts')
    expect(reviewSrc).toContain("deps.t('graph.review_unavailable'")
    expect(reviewSrc).toContain('deps.setBusy(true)')
    expect(reviewSrc).toContain('deps.toast.showError')
    expect(modelSrc).toContain('openNodeSource')
    expect(modelSrc).toContain('resolveGraphNodeSourcePreview')
  })

  it('keeps semantic and text search on the search tab and lists all hits', () => {
    const search = sliceBetween(
      embedPane(
        embedPane(src, '<GraphScreenSearchTab', searchTabSrc),
        '<GraphScreenReextractTab',
        reextractTabSrc
      ),
      "{tab === 'search' && (",
      "{tab === 'pending' && ("
    )
    expect(search).toContain("t('graph.search_semantic'")
    expect(search).toContain("t('graph.search_text'")
    expect(searchTabSrc).toContain('<SegmentedControl')
    expect(searchTabSrc).toContain('size="small"')
    expect(searchTabSrc).toContain('stretch={false}')
    expect(pageChrome).toContain('applySearchHits')
    expect(pageChrome).toContain('mode: nextMode')
    expect(pageChrome).not.toContain("setTab('graph')\n      setSelectedId(hit.id)")
  })

  it('locates pending nodes by opening detail instead of a mobile canvas', () => {
    const loc = sliceBetween(searchSrc, 'const locatePendingEdge', 'const onSearch')
    expect(src).toContain('void search.onSelectNode(id)')
    expect(src).toContain('void search.onSelectNode(edge.fromId)')
    expect(src).not.toContain('requestGraphCanvasLocate')
    expect(src).not.toContain('openCanvas')
    expect(canvasModelSrc).toContain('consumeGraphCanvasLocate')
    expect(loc).toContain('setHighlightedEdgeIds(new Set([edge.id]))')
    expect(loc).toContain('setLocateIds([from.id, to.id])')
    expect(loc).toContain('setLocalView({ nodes: [from, to], edges: [edge] })')
    expect(searchSrc).not.toContain("setTab('graph')")
  })

  it('fits the camera to locateIds after WebView reload', () => {
    expect(webviewSrc).toContain('function cameraFitIds()')
    expect(webviewSrc).toContain('highlightEdgeIds')
    expect(webviewSrc).toContain('(locateIdsRef.current?.length ?? 0) > 0')
    expect(webviewSrc).not.toContain('cameraTargetForSelected')
  })

  it('should render discriminator as its own label when a node has been split', () => {
    expect(pageChrome).toContain('GraphDiscriminatorLabel')
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

  it('should inset the pending hint from the floating sheet top like similar merge', () => {
    const graphStyles = readSrc('GraphScreen.styles.ts')
    expect(graphStyles).toMatch(/pendingToolbar:[\s\S]*paddingTop: sharedTokens\.spacing\.md/)
    expect(similarTabSrc).toContain('contentContainerStyle={props.listPad}')
    expect(src).toContain('padding: sharedTokens.spacing.md')
  })

  it('should select a pending card by tapping the title row and keep review actions outside that pressable', () => {
    const graphStyles = readSrc('GraphScreen.styles.ts')
    expect(pendingTabSrc).toContain('onPress={() => props.onToggleItem(key)}')
    expect(pendingTabSrc).toContain('styles.card')
    expect(pendingTabSrc).toContain('styles.pendingTitleRow')
    expect(pendingTabSrc).not.toMatch(
      /onPress=\{\(\) => props\.onToggleItem\(key\)\}[\s\S]*\{nodeActions\}[\s\S]*<\/Pressable>/
    )
    expect(pendingTabSrc).toContain('onViewNodeSource')
    expect(pendingTabSrc).toContain("t('graph.node_detail', '详情')")
    expect(pendingTabSrc).toContain('styles.pendingActions')
    expect(pendingTabSrc).toContain('styles.pendingToolbarActions')
    expect(pendingTabSrc).not.toContain('style={{ marginTop: sharedTokens.spacing.xxs }}')
    expect(graphStyles).toMatch(/pendingActions:[\s\S]*justifyContent: 'flex-end'/)
    expect(graphStyles).toMatch(/pendingToolbarActions:[\s\S]*justifyContent: 'flex-end'/)
  })

  it('should paint node detail fields with native inputs and clear small buttons', () => {
    expect(detailSrc).toContain("from '@baishou/ui/native'")
    expect(detailSrc).toContain('Input')
    expect(detailSrc).toContain('Button')
    expect(detailSrc).toContain('textarea')
    expect(detailSrc).toContain('size="sm"')
    expect(detailSrc).not.toMatch(/<TextInput[\s>]/)
    expect(detailSrc).not.toContain('styles.renameInput')
    const graphStyles = readSrc('GraphScreen.styles.ts')
    expect(graphStyles).toMatch(
      /detailSummaryInput:[\s\S]*minHeight: sharedTokens\.spacing\.xxxl \* 2/
    )
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
      'max_nodes',
      'max_nodes_hint',
      'max_nodes_unlimited',
      'open_canvas',
      'mobile_canvas_paused_title',
      'mobile_canvas_paused_body',
      'open_in_ops',
      'open_node_detail',
      'tab_nodes',
      'view_list',
      'view_graph',
      'view_mode',
      'node_review_open_hint',
      'month_range_all',
      'tab_similar',
      'tab_similar_count',
      'similar_empty',
      'similar_hint',
      'similar_merge',
      'locate',
      'similar_keep_apart',
      'confirm_keep_apart',
      'confirm_keep_apart_named',
      'similar_dismissed',
      'merge_irreversible_warning'
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

  it('should align graph search section with vector fragments without dedicated search button', () => {
    const searchSection = readSrc('GraphScreenSearchSection.tsx')
    expect(searchSection).toContain('<Search')
    expect(searchSection).toContain('<X')
    expect(searchSection).toContain("Platform.OS === 'android'")
    expect(searchSection).toContain('<TextInput')
    expect(searchSection).not.toContain('<Button')
    expect(searchSection).toContain('debounceTimerRef')
    expect(searchSrc).toContain('searchSeqRef')
  })

  it('should inset overlay scroll indicators like skill cite preview', () => {
    const mergeSheetSrc = readSrc('GraphMergeSearchSheet.tsx')
    expect(overlaysSrc).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(splitSheetSrc).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(mergeSheetSrc).toContain('paddingRight: sharedTokens.spacing.mdTight')
  })

  it('should align embedded canvas margin with search and node list cards', () => {
    const updatedCanvasPaneSrc = readSrc('GraphScreenCanvasPane.tsx')
    const updatedEmbeddedSrc = readSrc('GraphScreenEmbeddedPane.tsx')
    expect(updatedCanvasPaneSrc).toContain('marginHorizontal: tokens.spacing.md')
    expect(updatedCanvasPaneSrc).not.toContain('marginHorizontal: tokens.spacing.sm')
    expect(updatedEmbeddedSrc).toContain('marginHorizontal: sharedTokens.spacing.md')
  })

  it('should place select-all and batch approve/reject actions on the same row', () => {
    const updatedPendingTabSrc = readSrc('GraphScreenPendingTab.tsx')
    const updatedStyles = readSrc('GraphScreen.styles.ts')
    expect(updatedPendingTabSrc).toMatch(
      /<View style=\{styles\.pendingToolbarRow\}>[\s\S]*styles\.pendingSelectAllGroup[\s\S]*styles\.pendingToolbarActions[\s\S]*<\/View>/
    )
    expect(updatedStyles).toMatch(/pendingToolbarRow:[\s\S]*justifyContent: 'space-between'/)
  })

  it('should show spinner indicator on batch review buttons without duplicate top banner', () => {
    const updatedPendingTabSrc = readSrc('GraphScreenPendingTab.tsx')
    const updatedReviewHookSrc = readSrc('useGraphScreenReview.ts')
    expect(updatedPendingTabSrc).toContain('reviewingSelectedStatus')
    expect(updatedPendingTabSrc).toContain('<ActivityIndicator')
    expect(updatedPendingTabSrc).toContain("t('graph.approving_selected'")
    expect(updatedPendingTabSrc).toContain("t('graph.rejecting_selected'")
    expect(updatedPendingTabSrc).not.toContain('accessibilityLiveRegion="polite"')
    expect(updatedReviewHookSrc).toContain('reviewingSelectedStatus')
    expect(updatedReviewHookSrc).toContain('setReviewingSelectedStatus(opts.reviewStatus)')
  })

  it('should navigate to graph-node page on node list item click instead of opening modal', () => {
    const routeSrc = readFileSync(join(dir, '../../../../app/graph-node.tsx'), 'utf8')
    expect(src).toContain('router.push(graphNodeHref(id))')
    expect(src).not.toContain('search.onSearchHitPress({ id }).then(() => setNodeDetailOpen(true))')
    expect(routeSrc).toContain('GraphNodeScreen')
    expect(nodeScreenSrc).toContain('StackScreenLayout')
    expect(nodeScreenSrc).toContain('GraphScreenDetailPane')
    expect(nodeScreenSrc).toContain('fullPage')
    expect(nodeScreenSrc).toContain('GraphScreenOverlays')
    expect(nodeScreenSrc).toContain('router.back()')
    expect(detailSrc).toContain('fullPage?: boolean')
  })

  it('should navigate to graph-node page on review node detail click instead of opening modal', () => {
    const reviewPage = readSrc('GraphReviewScreen.tsx')
    expect(reviewPage).toContain('router.push(graphNodeHref(id))')
    expect(reviewPage).not.toContain('FloatingModal')
    expect(reviewPage).not.toContain('nodeDetailOpen')
  })

  it('should navigate to graph-node page on canvas peek detail click instead of opening modal', () => {
    expect(src).toMatch(/onOpenPeekDetail=\{[\s\S]*router\.push\(graphNodeHref\(targetId\)\)/)
    expect(peekSrc).toContain("t('graph.open_node_detail'")
  })

  it('should right-align action button groups in detail, incident edges, and review tabs', () => {
    const graphStyles = readSrc('GraphScreen.styles.ts')
    const updatedSimilarTabSrc = readSrc('GraphScreenSimilarTab.tsx')
    const updatedReextractTabSrc = readSrc('GraphScreenReextractTab.tsx')
    const updatedDetailSrc = readSrc('GraphScreenDetailPane.tsx')
    expect(graphStyles).toMatch(/detailActions:[\s\S]*justifyContent: 'flex-end'/)
    expect(graphStyles).toMatch(/incidentActions:[\s\S]*justifyContent: 'flex-end'/)
    expect(updatedSimilarTabSrc).toContain("justifyContent: 'flex-end'")
    expect(updatedReextractTabSrc).toContain("justifyContent: 'flex-end'")
    expect(updatedDetailSrc).toContain('styles.incidentActions')
  })

  it('should refresh localView and show spinner feedback when reviewing edges or nodes in detail pane', () => {
    const updatedDataHookSrc = readSrc('useGraphScreenData.ts')
    const updatedDetailSrc = readSrc('GraphScreenDetailPane.tsx')
    const updatedNodeScreenSrc = readSrc('GraphNodeScreen.tsx')
    const updatedMainScreenSrc = readSrc('GraphScreen.tsx')

    // Verify useGraphScreenData refreshes localView when selectedId is present without early-returning on !pinNeighborhood
    expect(updatedDataHookSrc).toMatch(
      /if \(opts\.selectedId\) \{[\s\S]*const fresh = await mobileGetNode[\s\S]*mobileGetView[\s\S]*opts\.setLocalView\(view\)[\s\S]*return[\s\S]*\}[\s\S]*if \(!opts\.pinNeighborhood \|\| !opts\.localView\) return/
    )

    // Verify GraphScreenDetailPane shows loading spinner on edge and node review buttons and disables actions while busy
    expect(updatedDetailSrc).toContain('reviewingEdgeId')
    expect(updatedDetailSrc).toContain('reviewingNodeStatus')
    expect(updatedDetailSrc).toContain('isLoading={reviewingEdgeId === `${edge.id}:approved`}')
    expect(updatedDetailSrc).toContain('isLoading={reviewingEdgeId === `${edge.id}:rejected`}')
    expect(updatedDetailSrc).toContain("isLoading={reviewingNodeStatus === 'approved'}")
    expect(updatedDetailSrc).toContain("isLoading={reviewingNodeStatus === 'rejected'}")

    // Verify GraphNodeScreen and GraphScreen pass awaitable review promises
    expect(updatedNodeScreenSrc).toMatch(
      /onReviewEdge=\{\(edgeId, status, endpoints\) =>\s*review\.reviewEdge\(edgeId, status, endpoints\)\s*\}/
    )
    expect(updatedMainScreenSrc).toContain(
      'onReviewEdge={(edgeId, status, endpoints) =>\n                  review.reviewEdge(edgeId, status, endpoints)\n                }'
    )

    // Verify double-rAF yielding before heavy async logic so spinner paints without first-frame freeze
    expect(updatedDetailSrc).toContain(
      'requestAnimationFrame(() => requestAnimationFrame(() => resolve()))'
    )
    const updatedReviewHookSrc = readSrc('useGraphScreenReview.ts')
    expect(updatedReviewHookSrc).toContain(
      'requestAnimationFrame(() => requestAnimationFrame(() => resolve()))'
    )
  })

  it('should space edge type options naturally and render compact debounced search bar with mode toggle', () => {
    const graphStyles = readSrc('GraphScreen.styles.ts')
    const updatedDetailSrc = readSrc('GraphScreenDetailPane.tsx')
    const updatedDetailHookSrc = readSrc('useGraphScreenDetail.ts')

    // Verify style definitions for naturally spaced 2x3 chip grid and compact search toolbar
    expect(graphStyles).toContain('addEdgeTypeRow:')
    expect(graphStyles).toContain('addEdgeTypeChip:')
    expect(graphStyles).toContain("flexBasis: '30%'")
    expect(graphStyles).toContain('addEdgeSearchToolbar:')
    expect(graphStyles).toContain('addEdgeSearchBox:')
    expect(graphStyles).toContain('height: 34')

    // Verify GraphScreenDetailPane uses naturally spaced chips and mode toggle without explicit search button
    expect(updatedDetailSrc).toContain('styles.addEdgeTypeRow')
    expect(updatedDetailSrc).toContain('styles.addEdgeTypeChip')
    expect(updatedDetailSrc).toContain('styles.addEdgeSearchToolbar')
    expect(updatedDetailSrc).toContain('styles.addEdgeSearchBox')
    expect(updatedDetailSrc).toContain('<SegmentedControl')
    expect(updatedDetailSrc).toContain("label: t('graph.search_text'")
    expect(updatedDetailSrc).toContain("label: t('graph.search_semantic'")
    expect(updatedDetailSrc).not.toMatch(
      /<Button[^>]*>\s*\{t\('graph\.search',\s*'搜索'\)\}\s*<\/Button>/
    )

    // Verify useGraphScreenDetail manages addEdgeSearchMode and addEdgeSearching
    expect(updatedDetailHookSrc).toContain('addEdgeSearchMode')
    expect(updatedDetailHookSrc).toContain('setAddEdgeSearchMode')
    expect(updatedDetailHookSrc).toContain('addEdgeSearching')
    expect(updatedDetailHookSrc).toContain('setAddEdgeSearching')
  })

  it('should place node approval next to pending banner, open edge detail modal, and use modal for add-edge', () => {
    const graphStyles = readSrc('GraphScreen.styles.ts')
    const updatedDetailSrc = readSrc('GraphScreenDetailPane.tsx')

    // Verify node review banner style exists
    expect(graphStyles).toContain('nodeReviewBanner:')

    // Verify node approve and reject buttons are in pending banner
    expect(updatedDetailSrc).toContain('styles.nodeReviewBanner')
    expect(updatedDetailSrc).toContain("t('graph.node_pending_badge', '待确认节点')")

    // Verify detailActions is kept for node editing without review confusion
    expect(updatedDetailSrc).toContain("t('graph.save_edit', '保存修改')")
    expect(updatedDetailSrc).toContain("t('graph.delete_node', '删除')")

    // Verify incident row displays view detail button and opens edge detail modal
    expect(updatedDetailSrc).toContain("t('graph.view_detail', '查看详情')")
    expect(updatedDetailSrc).toContain('selectedEdgeDetail')
    expect(updatedDetailSrc).toContain("t('graph.edge_detail_title', '关系详情')")

    // Verify add edge is launched from compact button into modal
    expect(updatedDetailSrc).toContain('addEdgeModalOpen')
    expect(updatedDetailSrc).toContain('<FloatingModal')
  })

  it('should style edge detail modal with surface background, legible typography, and semantic approve/reject buttons', () => {
    const updatedDetailSrc = readSrc('GraphScreenDetailPane.tsx')
    const updatedPendingTabSrc = readSrc('GraphScreenPendingTab.tsx')

    const edgeModalChunk = updatedDetailSrc.slice(
      updatedDetailSrc.indexOf('selectedEdgeDetail ? ('),
      updatedDetailSrc.indexOf('addEdgeModalOpen ? (')
    )

    // Modal card background should use bgSurface instead of bgSurfaceNormal
    expect(edgeModalChunk).toContain('backgroundColor: colors.bgSurface')
    expect(edgeModalChunk).not.toContain('backgroundColor: colors.bgSurfaceNormal')

    // Typography should use title for header, secondary for labels, body for values & excerpts
    expect(edgeModalChunk).toContain('fontSize: mobileTypography.title.fontSize')
    expect(edgeModalChunk).toContain('fontSize: mobileTypography.secondary.fontSize')
    expect(edgeModalChunk).toContain('fontSize: mobileTypography.body.fontSize')

    // Approve and reject actions should use primary and destructive variants with modalActionsStyle
    expect(edgeModalChunk).toContain('modalActionsStyle')
    expect(edgeModalChunk).toContain('variant="primary"')
    expect(edgeModalChunk).toMatch(
      /<Button[^>]*variant="primary"[^>]*>[\s\S]*t\('graph\.approve', '通过'\)/
    )
    expect(edgeModalChunk).toMatch(
      /<Button[^>]*destructive[^>]*>[\s\S]*t\('graph\.reject', '拒绝'\)/
    )

    // Pending tab reject action should use error color
    expect(updatedPendingTabSrc).toContain('color: colors.error')

    // Pending and similar hint boxes should use clean bgSurface instead of dull grey bgSurfaceNormal
    const updatedSimilarTabSrc = readSrc('GraphScreenSimilarTab.tsx')
    expect(updatedPendingTabSrc).not.toContain('backgroundColor: colors.bgSurfaceNormal')
    expect(updatedSimilarTabSrc).not.toContain('backgroundColor: colors.bgSurfaceNormal')

    // Incident edges title and edge type should use mobileTypography.primary.fontSize
    expect(updatedDetailSrc).toMatch(
      /fontSize: mobileTypography\.primary\.fontSize[\s\S]*t\('graph\.incident_edges', '相关关系'\)/
    )
    expect(updatedDetailSrc).toMatch(
      /fontSize: mobileTypography\.primary\.fontSize[\s\S]*translateGraphEdgeType/
    )

    // Node review banner should use clean bgSurface instead of dull grey bgSurfaceNormal
    const nodeReviewBannerChunk = updatedDetailSrc.slice(
      updatedDetailSrc.indexOf('styles.nodeReviewBanner'),
      updatedDetailSrc.indexOf('node_pending_badge')
    )
    expect(nodeReviewBannerChunk).toContain('backgroundColor: colors.bgSurface')
    expect(nodeReviewBannerChunk).not.toContain('backgroundColor: colors.bgSurfaceNormal')

    // Split button text should be 拆分节点 and buttons placed together without flex:1 spacer
    expect(updatedDetailSrc).toContain("t('graph.split_node', '拆分节点')")
    expect(updatedDetailSrc).not.toMatch(
      /styles\.detailActions[\s\S]*<View style=\{\{ flex: 1 \}\} \/>[\s\S]*save_edit/
    )
  })

  it('should use merge_irreversible_warning in overlays and refresh survivor node selection after merge', () => {
    const overlaysSrc = readSrc('GraphScreenOverlays.tsx')
    expect(overlaysSrc).toContain('graph.merge_irreversible_warning')
    expect(overlaysSrc).not.toMatch(/warning=\{\s*t\(\s*['"]graph\.merge_irreversible['"]/)

    const confirmSrc = readSrc('GraphIrreversibleConfirm.tsx')
    expect(confirmSrc).toContain('survivor')
    expect(confirmSrc).toContain('losers')

    const reviewHookSrc = readSrc('useGraphScreenReview.ts')
    expect(reviewHookSrc).toContain('mobileGetNode(runtime.drizzleDb, deps.vaultId, survivorId)')
    expect(reviewHookSrc).toContain('deps.setSelectedNode(updatedSurvivor)')
    expect(reviewHookSrc).toContain("deps.t('graph.similar_keep_apart', '不是同一人')")
    expect(reviewHookSrc).toContain('deps.dialog.confirm(message, { title })')
  })
})
