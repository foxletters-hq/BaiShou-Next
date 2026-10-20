import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  src,
  detailSrc,
  graphStylesSrc,
  pendingTabSrc,
  similarTabSrc,
  overlaysSrc,
  modelSrc,
  settingsHookSrc,
  webviewSrc,
  sameNameListSrc,
  createSheetSrc,
  splitSheetSrc,
  candidatesUtilSrc,
  splitServiceSrc,
  pageChrome,
  dir
} from './graph-screen-chrome.test-helpers'

describe('GraphScreen chrome - node detail and split', () => {
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
    const graphStyles = graphStylesSrc
    expect(graphStyles).toMatch(/pendingToolbar:[\s\S]*paddingTop: sharedTokens\.spacing\.md/)
    expect(similarTabSrc).toContain('contentContainerStyle={props.listPad}')
    expect(src).toContain('padding: sharedTokens.spacing.md')
  })

  it('should select a pending card by tapping the title row and keep review actions outside that pressable', () => {
    const graphStyles = graphStylesSrc
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
    const graphStyles = graphStylesSrc
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
})
