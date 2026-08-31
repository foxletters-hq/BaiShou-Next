import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../GraphScreen.tsx'), 'utf8')
const webviewSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../GraphForceWebView.tsx'),
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

  it('keeps month range out of the browse settings section', () => {
    const view = sliceBetween("t('graph.view_section', '浏览')", "t('graph.appearance', '外观')")
    expect(view).toContain('renderDepthChips()')
    expect(view).not.toContain('GraphMonthRangeSheet')
  })

  it('mounts extract, create, and merge in the settings ops section', () => {
    const ops = sliceBetween("t('graph.side_ops', '操作')", "t('graph.view_section', '浏览')")
    expect(ops).toContain("t('graph.process_pending_reextract'")
    expect(ops).toContain("t('graph.extract_concurrency'")
    expect(ops).toContain("t('graph.create_node'")
    expect(ops).toContain("t('graph.merge_nodes'")
    expect(ops).toContain('GraphExtractHelpButton')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween("{tab === 'pending' && (", '<FloatingModal')
    expect(pending).toContain("t('graph.approve_selected'")
    expect(pending).toContain("t('graph.reject_selected'")
    expect(pending).toContain("t('graph.approve_all'")
    expect(pending).toContain("t('graph.reject_all'")
    expect(pending).toContain('graphPendingItemKey')
    expect(pending).toContain('<Checkbox')
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
})
