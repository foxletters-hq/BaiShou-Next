import { describe, expect, it } from 'vitest'
import {
  documentsFromHunks,
  documentsFromHunksAligned,
  isUnifiedDiffTruncated,
  parseUnifiedDiff,
  resolveFileChangeDocuments,
  reverseApplyHunksToModified,
  unifiedDiffToDocuments
} from '../unified-diff-to-documents'

const CREATE_DIFF = `--- a/notes/hello.md
+++ b/notes/hello.md
@@ -0,0 +1,3 @@
+# Hello
+
+world
`

const DELETE_DIFF = `--- a/gone.txt
+++ b/gone.txt
@@ -1,2 +0,0 @@
-alpha
-beta
`

const MODIFY_DIFF = `--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,5 @@
 const a = 1
-const b = 2
+const b = 20
 const c = 3
 const d = 4
 const e = 5
`

const MID_FILE_DIFF = `--- a/story.md
+++ b/story.md
@@ -20,4 +20,4 @@
 keep-before
-old paragraph
+new paragraph
 keep-after
 keep-tail
`

describe('isUnifiedDiffTruncated', () => {
  it('detects truncation marker', () => {
    expect(isUnifiedDiffTruncated(`${CREATE_DIFF}\n… (diff truncated)`)).toBe(true)
    expect(isUnifiedDiffTruncated(CREATE_DIFF)).toBe(false)
  })
})

describe('unifiedDiffToDocuments', () => {
  it('reconstructs create', () => {
    const docs = unifiedDiffToDocuments(CREATE_DIFF)
    expect(docs).not.toBeNull()
    expect(docs!.original).toBe('')
    expect(docs!.modified).toBe('# Hello\n\nworld\n')
    expect(docs!.truncated).toBe(false)
  })

  it('reconstructs delete', () => {
    const docs = unifiedDiffToDocuments(DELETE_DIFF)
    expect(docs).not.toBeNull()
    expect(docs!.original).toBe('alpha\nbeta\n')
    expect(docs!.modified).toBe('')
  })

  it('reconstructs modify from hunks', () => {
    const docs = unifiedDiffToDocuments(MODIFY_DIFF)
    expect(docs).not.toBeNull()
    expect(docs!.original).toBe('const a = 1\nconst b = 2\nconst c = 3\nconst d = 4\nconst e = 5\n')
    expect(docs!.modified).toBe('const a = 1\nconst b = 20\nconst c = 3\nconst d = 4\nconst e = 5\n')
  })

  it('returns null for empty diff', () => {
    expect(unifiedDiffToDocuments('')).toBeNull()
    expect(unifiedDiffToDocuments('--- a/x\n+++ b/x\n')).toBeNull()
  })

  it('flags truncated diffs', () => {
    const docs = unifiedDiffToDocuments(`${CREATE_DIFF}\n… (diff truncated)`)
    expect(docs?.truncated).toBe(true)
  })
})

describe('documentsFromHunksAligned', () => {
  it('pads to the hunk start so line numbers match the source file', () => {
    const parsed = parseUnifiedDiff(MID_FILE_DIFF)!
    const docs = documentsFromHunksAligned(parsed.hunks)
    const originalLines = docs.original.replace(/\n$/, '').split('\n')
    expect(originalLines).toHaveLength(23)
    expect(originalLines[19]).toBe('keep-before')
    expect(originalLines[20]).toBe('old paragraph')
  })
})

describe('reverseApplyHunksToModified', () => {
  it('recovers original from full modified + hunks', () => {
    const parsed = parseUnifiedDiff(MODIFY_DIFF)!
    const exactModified = documentsFromHunks(parsed.hunks).modified
    const result = reverseApplyHunksToModified(exactModified, parsed.hunks)
    expect(result.ok).toBe(true)
    expect(result.original).toBe(documentsFromHunks(parsed.hunks).original)

    const prefixed = reverseApplyHunksToModified(`prefix\n${exactModified}`, parsed.hunks)
    expect(prefixed.ok).toBe(true)
    expect(prefixed.original).toBe(`prefix\n${documentsFromHunks(parsed.hunks).original}`)
  })

  it('recovers original when disk uses CRLF and hunks are LF', () => {
    const parsed = parseUnifiedDiff(MODIFY_DIFF)!
    const lfModified = documentsFromHunks(parsed.hunks).modified
    const crlfModified = lfModified.replace(/\n/g, '\r\n')
    const result = reverseApplyHunksToModified(crlfModified, parsed.hunks)
    expect(result.ok).toBe(true)
    expect(result.original).toBe(documentsFromHunks(parsed.hunks).original)
  })

  it('handles pure create reverse', () => {
    const parsed = parseUnifiedDiff(CREATE_DIFF)!
    const modified = documentsFromHunks(parsed.hunks).modified
    const result = reverseApplyHunksToModified(modified, parsed.hunks)
    expect(result.ok).toBe(true)
    expect(result.original).toBe('')
  })
})

describe('resolveFileChangeDocuments', () => {
  it('falls back when empty', () => {
    expect(resolveFileChangeDocuments({ diff: '' })).toEqual({
      mode: 'fallback',
      truncated: false,
      reason: 'empty'
    })
  })

  it('falls back when truncated', () => {
    const result = resolveFileChangeDocuments({
      diff: `${MODIFY_DIFF}\n… (diff truncated)`
    })
    expect(result).toEqual({ mode: 'fallback', truncated: true, reason: 'truncated' })
  })

  it('uses disk content when reverse apply succeeds', () => {
    const parsed = parseUnifiedDiff(MODIFY_DIFF)!
    const modified = documentsFromHunks(parsed.hunks).modified
    const result = resolveFileChangeDocuments({
      diff: MODIFY_DIFF,
      diskAvailable: true,
      diskContent: modified
    })
    expect(result.mode).toBe('merge')
    if (result.mode === 'merge') {
      expect(result.modified).toBe(modified)
      expect(result.original).toBe(documentsFromHunks(parsed.hunks).original)
    }
  })

  it('uses hunk docs when disk is unavailable', () => {
    const result = resolveFileChangeDocuments({ diff: CREATE_DIFF })
    expect(result.mode).toBe('merge')
    if (result.mode === 'merge') {
      expect(result.original).toBe('')
      expect(result.modified).toBe('# Hello\n\nworld\n')
    }
  })

  it('keeps mid-file hunks at the recorded line numbers without disk', () => {
    const result = resolveFileChangeDocuments({ diff: MID_FILE_DIFF })
    expect(result.mode).toBe('merge')
    if (result.mode !== 'merge') return
    const originalLines = result.original.replace(/\n$/, '').split('\n')
    const modifiedLines = result.modified.replace(/\n$/, '').split('\n')
    expect(originalLines[19]).toBe('keep-before')
    expect(originalLines[20]).toBe('old paragraph')
    expect(modifiedLines[20]).toBe('new paragraph')
  })

  it('rebuilds the full original from disk when the change is mid-file', () => {
    const prefix = Array.from({ length: 19 }, (_, i) => `line-${i + 1}`).join('\n')
    const modified = `${prefix}\nkeep-before\nnew paragraph\nkeep-after\nkeep-tail\n`
    const result = resolveFileChangeDocuments({
      diff: MID_FILE_DIFF,
      diskAvailable: true,
      diskContent: modified
    })
    expect(result.mode).toBe('merge')
    if (result.mode !== 'merge') return
    expect(result.modified).toBe(modified)
    expect(result.original).toBe(`${prefix}\nkeep-before\nold paragraph\nkeep-after\nkeep-tail\n`)
  })

  it('falls back to aligned hunks when disk no longer contains the change', () => {
    const result = resolveFileChangeDocuments({
      diff: MID_FILE_DIFF,
      diskAvailable: true,
      diskContent: 'totally different\nfile\n'
    })
    expect(result.mode).toBe('merge')
    if (result.mode !== 'merge') return
    const originalLines = result.original.replace(/\n$/, '').split('\n')
    expect(originalLines[20]).toBe('old paragraph')
    expect(result.modified.replace(/\n$/, '').split('\n')[20]).toBe('new paragraph')
  })

  it('handles deleted file on disk', () => {
    const result = resolveFileChangeDocuments({
      diff: DELETE_DIFF,
      diskAvailable: true,
      diskContent: null
    })
    expect(result.mode).toBe('merge')
    if (result.mode === 'merge') {
      expect(result.modified).toBe('')
      expect(result.original).toBe('alpha\nbeta\n')
    }
  })
})
