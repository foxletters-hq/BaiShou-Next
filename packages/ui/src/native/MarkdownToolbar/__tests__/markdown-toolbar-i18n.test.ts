import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MARKDOWN_TOOLBAR_TOOL_META } from '../markdown-toolbar.types'

const here = dirname(fileURLToPath(import.meta.url))
const i18nDir = join(here, '../../../../../../packages/shared/src/i18n')

const LOCALES = ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']

const TOOLBAR_KEYS = [
  'toolbar_settings',
  'toolbar_settings_title',
  'toolbar_settings_hint',
  'toolbar_undo',
  'toolbar_redo',
  'toolbar_bold',
  'toolbar_italic',
  'toolbar_strikethrough',
  'toolbar_code',
  'toolbar_code_block',
  'toolbar_quote',
  'toolbar_list',
  'toolbar_insert_tag',
  'toolbar_insert_h5',
  'toolbar_insert_h6',
  'toolbar_insert_image',
  'toolbar_scroll_left',
  'toolbar_scroll_right',
  'toolbar_shortcuts',
  'toolbar_shortcuts_short',
  'shortcuts_modal_title',
  'shortcuts_section_general',
  'shortcuts_section_markdown',
  'shortcuts_section_editing',
  'shortcut_quick_save',
  'shortcut_search',
  'shortcut_link',
  'shortcut_table',
  'shortcut_continue_block',
  'shortcut_indent',
  'shortcut_open_link'
]

describe('markdown toolbar i18n', () => {
  it('should keep every toolbar and shortcut key in all four locales', () => {
    for (const file of LOCALES) {
      const diary = (
        JSON.parse(readFileSync(join(i18nDir, file), 'utf8')) as {
          diary: Record<string, string>
        }
      ).diary
      for (const key of TOOLBAR_KEYS) {
        expect(diary[key], `${file} missing diary.${key}`).toEqual(expect.any(String))
        expect(diary[key].length, `${file} empty diary.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('should resolve every reorderable tool label through an existing i18n key', () => {
    const zh = (
      JSON.parse(readFileSync(join(i18nDir, 'zh.i18n.json'), 'utf8')) as {
        diary: Record<string, string>
      }
    ).diary
    for (const meta of Object.values(MARKDOWN_TOOLBAR_TOOL_META)) {
      expect(meta.labelKey.startsWith('diary.'), `${meta.id} label key`).toBe(true)
      expect(zh[meta.labelKey.slice('diary.'.length)], `missing ${meta.labelKey}`).toEqual(
        expect.any(String)
      )
    }
  })
})
