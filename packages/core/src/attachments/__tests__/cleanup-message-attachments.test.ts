import { describe, it, expect, vi } from 'vitest'
import { cleanupAttachmentsForParts } from '../cleanup-message-attachments'

describe('cleanupAttachmentsForParts', () => {
  it('no-ops when parts empty', async () => {
    const attachmentManager = { deleteFilesReferencedByParts: vi.fn() }

    await cleanupAttachmentsForParts(attachmentManager, 's1', [])

    expect(attachmentManager.deleteFilesReferencedByParts).not.toHaveBeenCalled()
  })

  it('deletes referenced files from provided parts', async () => {
    const parts = [{ type: 'image', data: { filePath: '/Attachments/s1/a.jpg' } }]
    const attachmentManager = { deleteFilesReferencedByParts: vi.fn().mockResolvedValue(undefined) }

    await cleanupAttachmentsForParts(attachmentManager, 's1', parts)

    expect(attachmentManager.deleteFilesReferencedByParts).toHaveBeenCalledWith('s1', parts)
  })

  it('swallows delete errors so message deletion is not blocked', async () => {
    const attachmentManager = {
      deleteFilesReferencedByParts: vi.fn().mockRejectedValue(new Error('disk fail'))
    }

    await expect(
      cleanupAttachmentsForParts(attachmentManager, 's1', [{ type: 'image', data: {} }])
    ).resolves.toBeUndefined()
  })
})
