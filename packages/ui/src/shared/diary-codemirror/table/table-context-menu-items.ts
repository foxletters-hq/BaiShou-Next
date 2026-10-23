import i18n from 'i18next'
import type { ParsedTable } from './table.model'
import type { TableMenuItem, TableMenuSection } from './table-context-menu.types'

export function buildColMenuSections(table: ParsedTable, colIndex: number): TableMenuSection[] {
  const colCount = table.columnCount
  return [
    {
      items: [
        {
          id: 'sort-asc',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L132',
            '按列排序 (A-Z)'
          )
        },
        {
          id: 'sort-desc',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L133',
            '按列排序 (Z-A)'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'align-none',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L138',
            '取消对齐'
          )
        },
        {
          id: 'align-left',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L139',
            '左对齐'
          )
        },
        {
          id: 'align-center',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L140',
            '居中对齐'
          )
        },
        {
          id: 'align-right',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L141',
            '右对齐'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'duplicate-col',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L146',
            '复制列'
          )
        },
        {
          id: 'clear-col',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L147',
            '清空列'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'insert-col-left',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L152',
            '在左侧插入列'
          )
        },
        {
          id: 'insert-col-right',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L153',
            '在右侧插入列'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'left',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L158',
            '向左移动列'
          ),
          disabled: colIndex <= 0
        },
        {
          id: 'right',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L159',
            '向右移动列'
          ),
          disabled: colIndex >= colCount - 1
        }
      ]
    },
    {
      items: [
        {
          id: 'delete',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L163',
            '删除列'
          ),
          disabled: colCount <= 1,
          destructive: true
        }
      ]
    }
  ]
}

export function buildRowMenuSections(table: ParsedTable, rowIndex: number): TableMenuSection[] {
  if (rowIndex < 0) {
    return [
      {
        items: [
          {
            id: 'noop',
            label: i18n.t(
              'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L170',
              '表头行'
            ),
            disabled: true
          }
        ]
      }
    ]
  }
  const rowCount = table.bodyRows.length
  return [
    {
      items: [
        {
          id: 'insert-row-above',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L176',
            '在上方插入行'
          )
        },
        {
          id: 'insert-row-below',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L177',
            '在下方插入行'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'up',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L182',
            '向上移动行'
          ),
          disabled: rowIndex <= 0
        },
        {
          id: 'down',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L183',
            '向下移动行'
          ),
          disabled: rowIndex >= rowCount - 1
        }
      ]
    },
    {
      items: [
        {
          id: 'duplicate-row',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L188',
            '复制行'
          )
        },
        {
          id: 'clear-row',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L189',
            '清空行'
          )
        },
        {
          id: 'copy-row',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L190',
            '复制行到剪贴板'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'delete',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.table.tableContextMenu.L194',
            '删除行'
          ),
          destructive: true
        }
      ]
    }
  ]
}

export function buildCellContextMenuSections(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number
): TableMenuSection[] {
  return rowIndex < 0
    ? buildColMenuSections(table, colIndex)
    : buildRowMenuSections(table, rowIndex)
}

export function buildColMenuItems(table: ParsedTable, colIndex: number): TableMenuItem[] {
  return buildColMenuSections(table, colIndex).flatMap((s) => s.items)
}

export function buildRowMenuItems(table: ParsedTable, rowIndex: number): TableMenuItem[] {
  return buildRowMenuSections(table, rowIndex).flatMap((s) => s.items)
}
