import { describe, expect, it } from 'vitest'
import type { FileDiff } from '@baishou/shared'
import {
  fileDiffToSplitRows,
  fileDiffToUnifiedRows,
  isNoNewlineMarker,
  splitInlineChange
} from '../git-diff.utils'

const sampleDiff: FileDiff = {
  path: 'Personal/Assistants/a.json',
  hunks: [
    {
      oldStart: 19,
      oldLines: 7,
      newStart: 20,
      newLines: 8,
      content: [
        '   "modelId": null,',
        '-  "sortOrder": 0,',
        '+  "sortOrder": 2,',
        '   "name": "45",',
        '-  "updatedAt": "2026-07-13T09:54:33.000Z"',
        '+  "updatedAt": "2026-08-11T06:13:07.000Z",',
        '+  "vaultId": "vlt_845f9286400f4269"',
        ' \\ No newline at end of file'
      ].join('\n')
    }
  ]
}

describe('splitInlineChange', () => {
  it('highlights only the changed value in similar JSON lines', () => {
    const inline = splitInlineChange('  "sortOrder": 0,', '  "sortOrder": 2,')
    expect(inline).toEqual({
      old: { prefix: '  "sortOrder": ', changed: '0', suffix: ',' },
      next: { prefix: '  "sortOrder": ', changed: '2', suffix: ',' }
    })
  })

  it('returns null when two lines share almost nothing', () => {
    expect(splitInlineChange('  "sortOrder": 0,', '  "vaultId": "vlt_1"')).toBeNull()
  })
})

describe('fileDiffToUnifiedRows', () => {
  it('adds line numbers, markers and skips the no-newline marker', () => {
    const rows = fileDiffToUnifiedRows(sampleDiff)
    expect(rows[0]).toEqual({
      kind: 'hunk',
      text: '@@ -19,7 +20,8 @@'
    })
    const sortRemove = rows.find(
      (row) => row.kind === 'remove' && row.text.includes('sortOrder')
    )
    const sortAdd = rows.find((row) => row.kind === 'add' && row.text.includes('sortOrder'))
    expect(sortRemove).toMatchObject({
      kind: 'remove',
      oldNum: 20,
      marker: '-',
      inline: { changed: '0' }
    })
    expect(sortAdd).toMatchObject({
      kind: 'add',
      newNum: 21,
      marker: '+',
      inline: { changed: '2' }
    })
    expect(rows.some((row) => row.kind === 'meta')).toBe(true)
    expect(rows.some((row) => row.kind !== 'hunk' && row.kind !== 'meta' && 'text' in row && row.text.includes('No newline'))).toBe(
      false
    )
  })
})

describe('fileDiffToSplitRows', () => {
  it('pairs adjacent remove and add onto one replace row', () => {
    const rows = fileDiffToSplitRows(sampleDiff)
    const sortRow = rows.find((row) => row.leftText?.includes('sortOrder'))
    expect(sortRow).toMatchObject({
      kind: 'replace',
      leftText: '  "sortOrder": 0,',
      rightText: '  "sortOrder": 2,',
      leftInline: { changed: '0' },
      rightInline: { changed: '2' }
    })
  })
})

describe('isNoNewlineMarker', () => {
  it('detects git no-newline lines', () => {
    expect(isNoNewlineMarker('\\ No newline at end of file')).toBe(true)
    expect(isNoNewlineMarker('  "name": "45",')).toBe(false)
  })
})
