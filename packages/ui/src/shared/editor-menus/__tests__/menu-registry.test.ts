import { describe, it, expect, beforeEach } from 'vitest'
import { registerCommand, resetCommandRegistryForTests } from '../command-registry'
import { appendMenuItem, resetMenuRegistryForTests, resolveMenuItems } from '../menu-registry'
import { MenuId } from '../menu-id'

describe('menu-registry', () => {
  beforeEach(() => {
    resetCommandRegistryForTests()
    resetMenuRegistryForTests()

    registerCommand({
      id: 'a.copy',
      labelKey: 'a.copy',
      defaultLabel: 'Copy',
      run: () => undefined
    })
    registerCommand({
      id: 'a.cut',
      labelKey: 'a.cut',
      defaultLabel: 'Cut',
      isEnabled: (ctx: { writable: boolean }) => ctx.writable,
      run: () => undefined
    })
    registerCommand({
      id: 'a.undo',
      labelKey: 'a.undo',
      defaultLabel: 'Undo',
      run: () => undefined
    })
  })

  it('should sort by group then order when resolveMenuItems', () => {
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.undo',
      group: 'z_commands',
      order: 1
    })
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.copy',
      group: '9_cutcopypaste',
      order: 2
    })
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.cut',
      group: '9_cutcopypaste',
      order: 1
    })

    const items = resolveMenuItems(MenuId.EditorContext, { writable: true })

    expect(items.map((item) => (item.type === 'command' ? item.commandId : 'sep'))).toEqual([
      'a.cut',
      'a.copy',
      'sep',
      'a.undo'
    ])
  })

  it('should filter by when when resolveMenuItems', () => {
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.copy',
      group: '9_cutcopypaste',
      order: 1
    })
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.cut',
      group: '9_cutcopypaste',
      order: 2,
      when: (ctx: { writable: boolean }) => ctx.writable
    })

    const hidden = resolveMenuItems(MenuId.EditorContext, { writable: false })
    expect(hidden).toHaveLength(1)
    expect(hidden[0]).toMatchObject({ type: 'command', commandId: 'a.copy' })
  })

  it('should mark disabled from command isEnabled when resolveMenuItems', () => {
    appendMenuItem({
      menuId: MenuId.EditorContext,
      commandId: 'a.cut',
      group: '9_cutcopypaste',
      order: 1
    })

    const items = resolveMenuItems(MenuId.EditorContext, { writable: false })
    expect(items[0]).toMatchObject({
      type: 'command',
      commandId: 'a.cut',
      disabled: true
    })
  })
})
