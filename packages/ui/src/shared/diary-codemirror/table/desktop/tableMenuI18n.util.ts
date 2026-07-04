/** ckant 表格行列菜单英文原文 → i18n key（包内无 locale 配置） */
export const CKANT_MENU_LABEL_KEYS: Record<string, string> = {
  'Sort by row (A-Z)': 'diary.table_menu.sort_asc_row',
  'Sort by column (A-Z)': 'diary.table_menu.sort_asc_column',
  'Sort by row (Z-A)': 'diary.table_menu.sort_desc_row',
  'Sort by column (Z-A)': 'diary.table_menu.sort_desc_column',
  'Align none': 'diary.table_menu.align_none',
  'Align left': 'diary.table_menu.align_left',
  'Align center': 'diary.table_menu.align_center',
  'Align right': 'diary.table_menu.align_right',
  'Add row above': 'diary.table_menu.add_row_above',
  'Add column before': 'diary.table_menu.add_column_before',
  'Add row below': 'diary.table_menu.add_row_below',
  'Add column after': 'diary.table_menu.add_column_after',
  'Move row up': 'diary.table_menu.move_row_up',
  'Move column left': 'diary.table_menu.move_column_left',
  'Move row down': 'diary.table_menu.move_row_down',
  'Move column right': 'diary.table_menu.move_column_right',
  'Duplicate row': 'diary.table_menu.duplicate_row',
  'Duplicate column': 'diary.table_menu.duplicate_column',
  'Clear row': 'diary.table_menu.clear_row',
  'Clear column': 'diary.table_menu.clear_column',
  'Delete row': 'diary.table_menu.delete_row',
  'Delete column': 'diary.table_menu.delete_column'
}

export type DiaryTableMenuTranslate = (key: string, defaultValue: string) => string

export function translateCkantMenuLabel(
  englishLabel: string,
  translate: DiaryTableMenuTranslate
): string {
  const trimmed = englishLabel.trim()
  const key = CKANT_MENU_LABEL_KEYS[trimmed]
  if (!key) return englishLabel
  return translate(key, trimmed)
}

export function applyCkantTableMenuI18n(
  root: ParentNode,
  translate: DiaryTableMenuTranslate
): void {
  root.querySelectorAll('.tbl-menu-item-text').forEach((node) => {
    const el = node as HTMLElement
    const visible = el.textContent?.trim() ?? ''
    if (!visible) return

    let english = el.dataset.ckantMenuEn
    if (!english) {
      if (!CKANT_MENU_LABEL_KEYS[visible]) return
      english = visible
      el.dataset.ckantMenuEn = english
    }

    const localized = translateCkantMenuLabel(english, translate)
    if (!localized || el.textContent === localized) return
    el.textContent = localized
  })
}
