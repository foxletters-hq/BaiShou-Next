import i18n from 'i18next'
/** 可排序的工具栏按钮（不含固定的「设置」按钮） */
export type MarkdownToolbarToolId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'quote'
  | 'list'
  | 'hash'
  | 'h5'
  | 'h6'
  | 'image'

export const MARKDOWN_TOOLBAR_TOOL_IDS: MarkdownToolbarToolId[] = [
  'undo',
  'redo',
  'bold',
  'italic',
  'strikethrough',
  'code',
  'quote',
  'list',
  'hash',
  'h5',
  'h6',
  'image'
]

export const DEFAULT_MARKDOWN_TOOLBAR_ORDER: MarkdownToolbarToolId[] = [
  ...MARKDOWN_TOOLBAR_TOOL_IDS
]

export interface MarkdownToolbarToolMeta {
  id: MarkdownToolbarToolId
  labelKey: string
  labelDefault: string
}

export const MARKDOWN_TOOLBAR_TOOL_META: Record<MarkdownToolbarToolId, MarkdownToolbarToolMeta> = {
  undo: {
    id: 'undo',
    labelKey: 'diary.toolbar_undo',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L42',
      '撤销'
    )
  },
  redo: {
    id: 'redo',
    labelKey: 'diary.toolbar_redo',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L43',
      '重做'
    )
  },
  bold: {
    id: 'bold',
    labelKey: 'diary.toolbar_bold',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L44',
      '加粗'
    )
  },
  italic: {
    id: 'italic',
    labelKey: 'diary.toolbar_italic',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L45',
      '斜体'
    )
  },
  strikethrough: {
    id: 'strikethrough',
    labelKey: 'diary.toolbar_strikethrough',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L49',
      '删除线'
    )
  },
  code: {
    id: 'code',
    labelKey: 'diary.toolbar_code',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L51',
      '行内代码'
    )
  },
  quote: {
    id: 'quote',
    labelKey: 'diary.toolbar_quote',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L52',
      '引用'
    )
  },
  list: {
    id: 'list',
    labelKey: 'diary.toolbar_list',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L53',
      '无序列表'
    )
  },
  hash: {
    id: 'hash',
    labelKey: 'diary.toolbar_insert_tag',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L54',
      '插入标签'
    )
  },
  h5: {
    id: 'h5',
    labelKey: 'diary.toolbar_insert_h5',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L55',
      '五级标题'
    )
  },
  h6: {
    id: 'h6',
    labelKey: 'diary.toolbar_insert_h6',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L56',
      '六级标题'
    )
  },
  image: {
    id: 'image',
    labelKey: 'diary.toolbar_insert_image',
    labelDefault: i18n.t(
      'auto.packages.ui.src.native.MarkdownToolbar.markdown.toolbar.types.L57',
      '插入图片'
    )
  }
}

function isLegacyIgnoredId(id: string): boolean {
  return id === 'divider' || id.startsWith('divider_') || id === 'readAloud'
}

export function normalizeMarkdownToolbarOrder(
  saved: string[] | null | undefined
): MarkdownToolbarToolId[] {
  if (!saved?.length) return [...DEFAULT_MARKDOWN_TOOLBAR_ORDER]

  const valid = new Set(MARKDOWN_TOOLBAR_TOOL_IDS)
  const seen = new Set<MarkdownToolbarToolId>()
  const ordered: MarkdownToolbarToolId[] = []

  for (const id of saved) {
    if (isLegacyIgnoredId(id)) continue
    if (!valid.has(id as MarkdownToolbarToolId) || seen.has(id as MarkdownToolbarToolId)) continue
    ordered.push(id as MarkdownToolbarToolId)
    seen.add(id as MarkdownToolbarToolId)
  }

  for (const id of MARKDOWN_TOOLBAR_TOOL_IDS) {
    if (!seen.has(id)) ordered.push(id)
  }

  return ordered
}
