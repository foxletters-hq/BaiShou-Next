import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '../GraphScreen.tsx'), 'utf8')
const webviewSrc = readFileSync(join(dir, '../GraphForceWebView.tsx'), 'utf8')
const sameNameListSrc = readFileSync(join(dir, '../GraphNodeSameNameList.tsx'), 'utf8')
const createSheetSrc = readFileSync(join(dir, '../GraphCreateNodeSheet.tsx'), 'utf8')
const candidatesUtilSrc = readFileSync(
  join(dir, '../../../services/graph-name-candidates.util.ts'),
  'utf8'
)

function sliceBetween(start: string, end: string): string {
  const from = src.indexOf(start)
  const to = src.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return src.slice(from, to)
}

describe('GraphScreen chrome', () => {
  it('keeps month, global, and settings on the toolbar and leaves create/merge out', () => {
    const toolbar = sliceBetween('styles.toolbarRow', 'renderDepthChips()')
    expect(toolbar).toContain('GraphMonthRangeSheet')
    expect(toolbar).toContain("t('graph.global_view'")
    expect(toolbar).toContain("t('graph.settings'")
    expect(toolbar).not.toContain("t('graph.create_node'")
    expect(toolbar).not.toContain("t('graph.merge_nodes'")
    expect(toolbar).not.toContain("t('graph.extract_concurrency'")
  })

  it('keeps isolated nodes on the canvas and uses the switch only for names', () => {
    expect(src).not.toContain('filterGraphIsolatedDisplayNodes')
    expect(src).toContain("t('graph.show_isolated_nodes'")
    expect(src).toContain('showIsolatedNodes')
    expect(webviewSrc).toContain('appearance.showIsolatedNodes !== false')
  })

  it('keeps month range out of the canvas settings section', () => {
    const canvas = sliceBetween("t('graph.side_canvas', '画布')", "t('graph.appearance', '外观')")
    expect(canvas).toContain('renderDepthChips()')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('GraphMonthRangeSheet')
    expect(src).not.toContain("t('graph.view_section'")
  })

  it('mounts extract, create, merge, and identity in the organize settings section', () => {
    const organize = sliceBetween("t('graph.side_organize', '整理')", "t('graph.side_canvas', '画布')")
    expect(organize).toContain("t('graph.process_pending_reextract'")
    expect(organize).toContain("t('graph.extract_concurrency'")
    expect(organize).toContain("t('graph.create_node'")
    expect(organize).toContain("t('graph.merge_nodes'")
    expect(organize).toContain('GraphExtractHelpButton')
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
    expect(src).toContain('data: false')
    expect(src).toContain('runExtractOne')
    expect(src).toContain('clearLifeGraph')
    expect(src).toContain('mobileClearLifeGraph')
  })

  it('keeps clear-life-graph out of account settings', () => {
    const accountSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../SettingsScreen/components/SettingsAccountPanel.tsx'),
      'utf8'
    )
    expect(accountSrc).not.toContain('ClearLifeGraphDangerBlock')
    expect(accountSrc).not.toContain('clearLifeGraph')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween("{tab === 'pending' && (", '<FloatingModal')
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
    const search = sliceBetween("{tab === 'search' && (", "{tab === 'reextract' && (")
    expect(search).toContain("t('graph.search_semantic'")
    expect(search).toContain("t('graph.search_text'")
    expect(src).toContain('applySearchHits')
    expect(src).toContain('mode: nextMode')
    expect(src).not.toContain("setTab('graph')\n      setSelectedId(hit.id)")
  })

  it('locates pending nodes by selection and pending edges by both endpoints', () => {
    const loc = sliceBetween('const locatePendingEdge', 'const onSearch')
    expect(src).toContain('locatePendingNode')
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
    expect(src).toContain('GraphDiscriminatorLabel')
    expect(src).toContain('discriminator: n.discriminator')
    expect(src).not.toContain('`${selectedNode.name}')
    expect(src).not.toContain("selectedNode.name + ' ('")
    expect(src).not.toContain('n.name + n.discriminator')
    expect(webviewSrc).toContain('n.discriminator')
    expect(webviewSrc).toContain('fillText(n.name.slice')
    expect(webviewSrc).not.toContain('n.name + n.discriminator')
    expect(webviewSrc).not.toContain("n.name + '('")
  })

  it('should list registered same-name entities in node detail when the name has been split', () => {
    expect(src).toContain('GraphNodeSameNameList')
    expect(src).toContain('listRegisteredSameNameEntities')
    expect(candidatesUtilSrc).toContain('readGraphNameRegistry')
    expect(sameNameListSrc).toContain("t('graph.same_name_entities'")
    expect(sameNameListSrc).toContain("t('graph.discriminator_label'")
    expect(sameNameListSrc).toContain('onOpen')
    expect(sameNameListSrc).not.toContain('${entity.name}')
    expect(sameNameListSrc).not.toContain("entity.name + ' ('")
  })

  it('should omit split and revert-split actions when the graph screen is shown on mobile', () => {
    for (const file of [src, sameNameListSrc, createSheetSrc]) {
      expect(file).not.toContain('splitGraphNode')
      expect(file).not.toContain('revertGraphSplit')
      expect(file).not.toContain('unsplitGraphNode')
      expect(file).not.toContain("t('graph.split_node'")
      expect(file).not.toContain("t('graph.revert_split'")
      expect(file).not.toContain("t('graph.unsplit")
      expect(file).not.toContain("t('graph.withdraw_split'")
      expect(file).not.toContain('mobileSplitGraph')
      expect(file).not.toContain('mobileRevertSplit')
    }
  })
})
