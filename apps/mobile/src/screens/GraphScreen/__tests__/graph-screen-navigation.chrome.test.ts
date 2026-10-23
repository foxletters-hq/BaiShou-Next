import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  src,
  peekSrc,
  detailSrc,
  graphStylesSrc,
  nodeScreenSrc,
  overlaysSrc,
  searchSrc,
  splitSheetSrc,
  readSrc,
  dir
} from './graph-screen-chrome.test-helpers'

describe('GraphScreen chrome - navigation and action layout', () => {
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
    const updatedStyles = graphStylesSrc
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
    const graphStyles = graphStylesSrc
    const updatedSimilarTabSrc = readSrc('GraphScreenSimilarTab.tsx')
    const updatedReextractTabSrc = readSrc('GraphScreenReextractTab.tsx')
    const updatedDetailSrc = detailSrc
    expect(graphStyles).toMatch(/detailActions:[\s\S]*justifyContent: 'flex-end'/)
    expect(graphStyles).toMatch(/incidentActions:[\s\S]*justifyContent: 'flex-end'/)
    expect(updatedSimilarTabSrc).toContain("justifyContent: 'flex-end'")
    expect(updatedReextractTabSrc).toContain("justifyContent: 'flex-end'")
    expect(updatedDetailSrc).toContain('styles.incidentActions')
  })

  it('should refresh localView and show spinner feedback when reviewing edges or nodes in detail pane', () => {
    const updatedDataHookSrc = readSrc('useGraphScreenData.ts')
    const updatedDetailSrc = detailSrc
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
    const graphStyles = graphStylesSrc
    const updatedDetailSrc = detailSrc
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
    const graphStyles = graphStylesSrc
    const updatedDetailSrc = detailSrc

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
    const updatedDetailSrc = detailSrc
    const updatedPendingTabSrc = readSrc('GraphScreenPendingTab.tsx')

    const edgeSectionSrc = readSrc('GraphScreenDetailEdgeSection.tsx')
    const edgeModalChunk = edgeSectionSrc.slice(edgeSectionSrc.indexOf('selectedEdgeDetail ? ('))

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
    expect(reviewHookSrc).toContain('deps.dialog.confirm(opts.message, {')
    expect(reviewHookSrc).toContain('title: opts.title')
  })
})
