import { describe, expect, it } from 'vitest'
import {
  documentsFromHunks,
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

describe('reverseApplyHunksToModified', () => {
  it('recovers original from full modified + hunks', () => {
    const parsed = parseUnifiedDiff(MODIFY_DIFF)!
    const exactModified = documentsFromHunks(parsed.hunks).modified
    const result = reverseApplyHunksToModified(exactModified, parsed.hunks)
    expect(result.ok).toBe(true)
    expect(result.original).toBe(documentsFromHunks(parsed.hunks).original)

    // Prefix shifts line numbers — hunk no longer aligns → fail
    const mismatched = reverseApplyHunksToModified(`prefix\n${exactModified}`, parsed.hunks)
    expect(mismatched.ok).toBe(false)
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
