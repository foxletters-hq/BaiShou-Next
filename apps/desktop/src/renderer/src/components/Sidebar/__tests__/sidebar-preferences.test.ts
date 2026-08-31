import { afterEach, describe, expect, it } from 'vitest'
import {
  loadHiddenNavItems,
  loadSidebarNavOrder,
  migrateSidebarNavIdsToMemory
} from '../sidebar-preferences'

afterEach(() => {
  localStorage.clear()
})

describe('migrateSidebarNavIdsToMemory', () => {
  it('keeps memory visible when the old graph item was visible', () => {
    const result = migrateSidebarNavIdsToMemory({
      order: ['diary', 'companion', 'summary', 'graph', 'incremental-sync'],
      hidden: []
    })
    expect(result.order).toContain('memory')
    expect(result.order).not.toContain('graph')
    expect(result.order).not.toContain('rag')
    expect(result.hidden).not.toContain('memory')
  })

  it('keeps memory visible when only the old rag item was visible', () => {
    const result = migrateSidebarNavIdsToMemory({
      order: ['diary', 'rag', 'summary'],
      hidden: ['graph']
    })
    expect(result.order).toContain('memory')
    expect(result.hidden).not.toContain('memory')
    expect(result.hidden).not.toContain('graph')
    expect(result.hidden).not.toContain('rag')
  })

  it('hides memory when both old graph and rag were hidden', () => {
    const result = migrateSidebarNavIdsToMemory({
      order: ['diary', 'graph', 'rag', 'summary'],
      hidden: ['graph', 'rag']
    })
    expect(result.order).toContain('memory')
    expect(result.hidden).toContain('memory')
  })
})

describe('sidebar memory nav migration', () => {
  it('upgrades a configured preference that still lists graph into a visible memory item', () => {
    localStorage.setItem('desktop_sidebar_visibility_configured', '1')
    localStorage.setItem('desktop_sidebar_mv', '4')
    localStorage.setItem(
      'desktop_sidebar_nav_order',
      JSON.stringify(['diary', 'companion', 'summary', 'graph', 'incremental-sync'])
    )
    localStorage.setItem('desktop_sidebar_hidden_items', JSON.stringify([]))

    const order = loadSidebarNavOrder()
    const hidden = loadHiddenNavItems()

    expect(order).toContain('memory')
    expect(order).not.toContain('graph')
    expect(hidden).not.toContain('memory')
  })
})
