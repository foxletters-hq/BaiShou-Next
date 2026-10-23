import { describe, expect, it, vi } from 'vitest'
import { applyJsonlConflictResolved } from '@baishou/core-mobile'

describe('mobile jsonl conflict (shared applyJsonlConflictResolved)', () => {
  it('overwrites vault Graph and notebook graph', async () => {
    const lineMerge = vi.fn(async () => true)
    const overwriteUpload = vi.fn(async () => undefined)
    const overwriteDownload = vi.fn(async () => undefined)

    await expect(
      applyJsonlConflictResolved({
        filePath: 'Personal/Graph/edges/2026-07.jsonl',
        direction: 'upload',
        lineMerge,
        overwriteUpload,
        overwriteDownload
      })
    ).resolves.toBe('uploaded')
    expect(lineMerge).not.toHaveBeenCalled()
    expect(overwriteUpload).toHaveBeenCalledOnce()

    lineMerge.mockClear()
    overwriteUpload.mockClear()
    await expect(
      applyJsonlConflictResolved({
        filePath: 'Work/Notebooks/nb3/graph/extract-state/src_def.jsonl',
        direction: 'download',
        lineMerge,
        overwriteUpload,
        overwriteDownload
      })
    ).resolves.toBe('downloaded')
    expect(lineMerge).not.toHaveBeenCalled()
    expect(overwriteDownload).toHaveBeenCalledOnce()
  })
})
