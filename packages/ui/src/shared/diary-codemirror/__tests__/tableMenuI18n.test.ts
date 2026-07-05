import { describe, it, expect } from 'vitest'
import {
  applyCkantTableMenuI18n,
  translateCkantMenuLabel
} from '../table/desktop/tableMenuI18n.util'

describe('tableMenuI18n', () => {
  it('maps ckant English labels to i18n keys', () => {
    const translate = (key: string, defaultValue: string) =>
      key === 'diary.table_menu.align_left' ? '左对齐' : defaultValue

    expect(translateCkantMenuLabel('Align left', translate)).toBe('左对齐')
    expect(translateCkantMenuLabel('Unknown item', translate)).toBe('Unknown item')
  })

  it('localizes menu DOM nodes', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div class="tbl-menu"><div class="tbl-menu-item-text">Delete column</div></div>'

    applyCkantTableMenuI18n(root, (key, defaultValue) =>
      key === 'diary.table_menu.delete_column' ? '删除列' : defaultValue
    )

    expect(root.textContent).toContain('删除列')
    expect(root.querySelector('.tbl-menu-item-text')?.textContent).toBe('删除列')
  })

  it('can apply twice without changing finalized labels', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div class="tbl-menu"><div class="tbl-menu-item-text">Delete column</div></div>'

    const translate = (key: string, defaultValue: string) =>
      key === 'diary.table_menu.delete_column' ? '删除列' : defaultValue

    applyCkantTableMenuI18n(root, translate)
    applyCkantTableMenuI18n(root, translate)

    expect(root.querySelector('.tbl-menu-item-text')?.textContent).toBe('删除列')
    expect(root.querySelector('.tbl-menu-item-text')?.dataset.ckantMenuEn).toBe('Delete column')
  })
})
