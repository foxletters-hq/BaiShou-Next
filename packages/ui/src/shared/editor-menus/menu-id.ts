/** 声明式菜单贡献点；对齐 VS Code MenuId，保持轻量字符串常量。 */
export const MenuId = {
  EditorContext: 'editor/context',
  /** 预留：工作台文件树右键 */
  ExplorerContext: 'explorer/context',
  /** 预留：表格右键 */
  TableContext: 'table/context'
} as const

export type MenuIdValue = (typeof MenuId)[keyof typeof MenuId]
