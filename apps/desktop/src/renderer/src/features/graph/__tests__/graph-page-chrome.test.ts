import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '../GraphPage.tsx'), 'utf8')
const settingsSrc = readFileSync(join(dir, '../GraphCanvasSettingsPanel.tsx'), 'utf8')

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
    expect(toolbar).toContain('GraphMonthRangePicker')
    expect(toolbar).toContain("t('graph.global_view'")
    expect(toolbar).not.toContain("t('graph.create_node'")
    expect(toolbar).not.toContain("t('graph.merge_nodes'")
    expect(toolbar).not.toContain("t('graph.extract_concurrency'")
  })

  it('keeps month range and global view out of the browse settings section', () => {
    const view = sliceBetween(settingsSrc, "{t('graph.view_section'", "t('graph.appearance'")
    expect(view).toContain("t('graph.focus_depth'")
    expect(view).not.toContain('GraphMonthRangePicker')
    expect(view).not.toContain('clearToGlobal')
    expect(src).toContain('GraphMonthRangePicker')
    expect(src).toContain('clearToGlobal')
  })

  it('mounts extract, create, and merge in the ops rail', () => {
    const ops = sliceBetween(src, "{sideMode === 'ops' ? (", ") : sideMode === 'settings' ? (")
    expect(ops).toContain("t('graph.process_pending_reextract'")
    expect(ops).toContain("t('graph.extract_concurrency'")
    expect(ops).toContain("t('graph.create_node'")
    expect(ops).toContain("t('graph.merge_nodes'")
    expect(ops).toContain('GraphExtractHelpButton')
  })

  it('uses existing node-type colors for selected category chips', () => {
    const ops = sliceBetween(src, "{sideMode === 'ops' ? (", ") : sideMode === 'settings' ? (")
    expect(ops).toContain('graphNodeTypeColor')
    expect(ops).toContain('typeChipActive')
    expect(ops).not.toContain('genderChipActive')
  })

  it('mounts pending batch review actions', () => {
    const pending = sliceBetween(src, "{tab === 'pending' && (", "{tab === 'detail' && (")
    expect(pending).toContain("t('graph.approve_selected'")
    expect(pending).toContain("t('graph.reject_selected'")
    expect(pending).toContain("t('graph.approve_all'")
    expect(pending).toContain("t('graph.reject_all'")
    expect(pending).toContain('graphPendingItemKey')
    expect(pending).toContain('<Checkbox')
  })

  it('locates pending nodes by selection and pending edges by both endpoints', () => {
    const loc = sliceBetween(src, 'const locatePendingEdge', 'const applyQueueSnapshot')
    expect(src).toContain('locatePendingNode')
    expect(loc).toContain('setHighlightedEdgeIds(new Set([edge.id]))')
    expect(loc).toContain('setLocateIds([from.id, to.id])')
    expect(loc).toContain('setLocalView({ nodes: [from, to], edges: [edge] })')
    expect(src).toContain("'graph.legend_pending_edge'")
  })

  it('uses the themed Select for adding relations instead of a native html select', () => {
    expect(src).not.toContain('<select')
    expect(src).toContain('styles.editSelect')
    expect(src).toContain('<Select')
    expect(src).toContain('setAddEdgeType')
  })
})
