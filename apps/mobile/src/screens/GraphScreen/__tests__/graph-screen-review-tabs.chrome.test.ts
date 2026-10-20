import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  src,
  canvasModelSrc,
  searchTabSrc,
  reextractTabSrc,
  pendingTabSrc,
  similarTabSrc,
  settingsSrc,
  organizeSrc,
  overlaysSrc,
  searchSrc,
  modelSrc,
  webviewSrc,
  pageChrome,
  readSrc,
  sliceBetween,
  embedPane
} from './graph-screen-chrome.test-helpers'

describe('GraphScreen chrome - review tabs', () => {
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
})
