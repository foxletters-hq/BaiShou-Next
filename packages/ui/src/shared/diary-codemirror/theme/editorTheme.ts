import { EditorView } from '@codemirror/view'

import { editorThemeBase } from './editor-theme-base'
import { editorThemeMarkdown } from './editor-theme-markdown'
import { editorThemeTableChrome } from './editor-theme-table-chrome'
import { editorThemeTableMenu } from './editor-theme-table-menu'

export { mobileTouchEditorLayoutTheme, mobileTouchViewportTheme } from './editor-theme-mobile'

/** 按视觉域拆开的选择器在这里合并，调用方仍只从本文件取 editorTheme。 */
export const editorTheme = EditorView.baseTheme({
  ...editorThemeBase,
  ...editorThemeTableChrome,
  ...editorThemeTableMenu,
  ...editorThemeMarkdown
})
