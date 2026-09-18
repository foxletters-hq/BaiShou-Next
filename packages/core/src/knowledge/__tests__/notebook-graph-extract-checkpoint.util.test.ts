import { describe, expect, it } from 'vitest'
import {
  isNotebookGraphExtractComplete,
  needsNotebookGraphExtractJob,
  shouldRunNotebookGraphAlignOnly
} from '../notebook-graph-extract-checkpoint.util'

const done = {
  extractedTextHash: 'h1',
  windowsDone: 2,
  windowsTotal: 2
}

describe('notebook-graph-extract-checkpoint', () => {
  it('should not treat a finished extract as complete when alignWritten is missing', () => {
    expect(isNotebookGraphExtractComplete(done, 'h1')).toBe(false)
    expect(isNotebookGraphExtractComplete({ ...done, alignWritten: false }, 'h1')).toBe(false)
  })

  it('should skip only when hash matches, extract finished, and align written', () => {
    expect(isNotebookGraphExtractComplete({ ...done, alignWritten: true }, 'h1')).toBe(true)
    expect(isNotebookGraphExtractComplete({ ...done, alignWritten: true }, 'h2')).toBe(false)
    expect(
      isNotebookGraphExtractComplete({ ...done, windowsDone: 1, alignWritten: true }, 'h1')
    ).toBe(false)
  })

  it('should run align only when windows are extracted but align is not written', () => {
    expect(
      shouldRunNotebookGraphAlignOnly(
        { ...done, extractedWindows: [{ index: 0 } as never], alignWritten: false },
        'h1'
      )
    ).toBe(true)
    expect(shouldRunNotebookGraphAlignOnly({ ...done, alignWritten: true }, 'h1')).toBe(false)
    expect(shouldRunNotebookGraphAlignOnly(done, 'h1')).toBe(false)
  })

  it('should re-queue graph jobs when extractedWindows exist but align is not written', () => {
    expect(
      needsNotebookGraphExtractJob({
        extractedHash: 'abc',
        extractState: {
          extractedTextHash: 'abc',
          windowsDone: 2,
          windowsTotal: 2,
          extractedWindows: [{ index: 0 }],
          alignWritten: false
        }
      })
    ).toBe(true)
    expect(
      needsNotebookGraphExtractJob({
        extractedHash: 'abc',
        extractState: { extractedTextHash: 'abc', windowsDone: 2, windowsTotal: 2 }
      })
    ).toBe(false)
  })
})
