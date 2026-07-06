import { autocompletion } from '@codemirror/autocomplete'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import type { LanguageSupport } from '@codemirror/language'
import { keymap } from '@codemirror/view'
import {
  insertEmptyMarkdownTable,
  markdownTableAutocompleter,
  markdownTables,
  TableTheme
} from 'codemirror-markdown-tables'

/** 百守 CSS 变量 → ckant 表格主题（亮/暗共用变量，随 data-theme 切换） */
function createDiaryMarkdownTablesTheme() {
  return TableTheme.light.with({
    '--tbl-theme-row-background': 'var(--bg-surface, #ffffff)',
    '--tbl-theme-header-row-background': 'var(--bg-surface-high, #f0f2f5)',
    '--tbl-theme-even-row-background': 'var(--bg-surface, #ffffff)',
    '--tbl-theme-odd-row-background': 'var(--bg-surface, #ffffff)',
    '--tbl-theme-border-color': 'var(--border-muted, rgba(0, 0, 0, 0.08))',
    '--tbl-theme-border-hover-color': 'var(--color-primary, #5ba8f5)',
    '--tbl-theme-border-active-color': 'var(--color-primary, #5ba8f5)',
    '--tbl-theme-outline-color': 'var(--color-primary, #5ba8f5)',
    '--tbl-theme-text-color': 'var(--text-primary, #1a1c23)',
    '--tbl-theme-menu-border-color': 'var(--border-muted, rgba(0, 0, 0, 0.08))',
    '--tbl-theme-menu-background': 'var(--bg-surface-raised, #ffffff)',
    '--tbl-theme-menu-hover-background': 'var(--color-primary, #5ba8f5)',
    '--tbl-theme-menu-text-color': 'var(--text-primary, #1a1c23)',
    '--tbl-theme-menu-hover-text-color': 'var(--text-on-primary, #ffffff)',
    '--tbl-theme-select-all-focus-overlay': 'var(--color-primary-light, rgba(91, 168, 245, 0.25))',
    '--tbl-theme-select-all-blur-overlay': 'rgba(2, 2, 2, 0.15)'
  })
}

/** 桌面端表格：codemirror-markdown-tables（ckant） */
export function diaryMarkdownTablesCkant(): Extension[] {
  const theme = createDiaryMarkdownTablesTheme()
  return [
    markdownTables({
      theme: { light: theme, dark: theme },
      handlePosition: 'outside',
      extensions: [keymap.of(defaultKeymap)],
      globalKeyBindings: [...historyKeymap, ...searchKeymap]
    })
  ]
}

/** 空行输入 `|` 后弹出表格尺寸补全（桌面） */
export function diaryMarkdownTableAutocompletionExt(markdownSupport: LanguageSupport): Extension[] {
  return [
    autocompletion(),
    markdownSupport.language.data.of({
      autocomplete: markdownTableAutocompleter()
    })
  ]
}

export { insertEmptyMarkdownTable }
