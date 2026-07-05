import { describe, it, expect } from 'vitest'
import {
  isMarkdownTableClipboard,
  mergeTsvIntoGrid,
  shouldUseTableRangePaste,
  type TableGridModel
} from '../table/tableGridModel'
import { TableSection } from '../table/tableSection'
import { desktopPasteTableRange } from '../table/desktop/desktopRangeClipboard'

function buildDesktopBlock(grid: TableGridModel): HTMLElement {
  const root = document.createElement('div')
  root.className = 'cm-table-block cm-table-block--desktop'
  root.innerHTML = `
    <table class="cm-table-preview">
      <thead><tr>
        ${grid.header.map((cell, col) => `<th class="cm-table-grid-cell" data-row="0" data-col="${col}">
          <div class="cm-table-cell-inner">
            <div class="cm-table-cell-view" data-row="0" data-col="${col}"></div>
            <div class="cm-table-cell-source" data-row="0" data-col="${col}" data-raw=""></div>
          </div>
        </th>`).join('')}
      </tr></thead>
      <tbody>
        ${grid.rows
          .map(
            (row, rowIndex) => `<tr>${row
              .map(
                (cell, col) => `<td class="cm-table-grid-cell" data-row="${rowIndex + 1}" data-col="${col}">
          <div class="cm-table-cell-inner">
            <div class="cm-table-cell-view" data-row="${rowIndex + 1}" data-col="${col}"></div>
            <div class="cm-table-cell-source" data-row="${rowIndex + 1}" data-col="${col}" data-raw=""></div>
          </div>
        </td>`
              )
              .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
  return root
}

describe('desktop table paste', () => {
  it('detects markdown table clipboard', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    expect(isMarkdownTableClipboard(md)).toBe(true)
    expect(shouldUseTableRangePaste(md)).toBe(true)
  })

  it('detects multi-row TSV clipboard', () => {
    const tsv = 'a\tb\nc\td'
    expect(isMarkdownTableClipboard(tsv)).toBe(false)
    expect(shouldUseTableRangePaste(tsv)).toBe(true)
  })

  it('pastes TSV rows into separate grid rows', () => {
    const grid: TableGridModel = {
      header: ['h1', 'h2'],
      rows: [
        ['', ''],
        ['', '']
      ]
    }
    const block = buildDesktopBlock(grid)
    const bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }
    const next = desktopPasteTableRange(block, bounds, 'x\ty\nz\tw')
    expect(next.maxRow).toBe(1)
    expect(next.maxCol).toBe(1)

    const view0 = block.querySelector('.cm-table-cell-view[data-row="1"][data-col="0"]')
    const view1 = block.querySelector('.cm-table-cell-view[data-row="2"][data-col="1"]')
    expect(view0?.textContent).toBe('x')
    expect(view1?.textContent).toBe('w')
  })

  it('mergeTsvIntoGrid keeps each clipboard line on its own row', () => {
    const grid: TableGridModel = { header: [''], rows: [[''], [''], ['']] }
    mergeTsvIntoGrid(grid, TableSection.of({ start: 0, endExclusive: 3 }, { start: 0, endExclusive: 1 }), 'r1\nr2\nr3')
    expect(grid.rows[0]![0]).toBeTruthy()
    expect(grid.rows[1]![0]).toBeTruthy()
    expect(grid.rows[2]![0]).toBeTruthy()
  })
})
