import { describe, expect, it } from 'vitest'
import {
  extractVaultAttachmentsRelativePath,
  remapAttachmentPathToStorageRoot
} from '../attachment-path-remap.util'

describe('extractVaultAttachmentsRelativePath', () => {
  it('extracts vault-relative path from Android absolute path', () => {
    expect(
      extractVaultAttachmentsRelativePath(
        '/storage/emulated/0/Baishou-Love/Personal/Attachments/sid/a.jpeg'
      )
    ).toBe('Personal/Attachments/sid/a.jpeg')
  })

  it('extracts from Windows-mangled Android path', () => {
    expect(
      extractVaultAttachmentsRelativePath(
        'D:\\storage\\emulated\\0\\Baishou-Love\\Personal\\Attachments\\sid\\a.jpeg'
      )
    ).toBe('Personal/Attachments/sid/a.jpeg')
  })
})

describe('remapAttachmentPathToStorageRoot', () => {
  const root = 'D:/Baishou-Love'

  it('remaps Android absolute paths onto desktop storage root', () => {
    expect(
      remapAttachmentPathToStorageRoot(
        '/storage/emulated/0/Baishou-Love/Personal/Attachments/sid/a.jpeg',
        root
      )
    ).toBe('D:/Baishou-Love/Personal/Attachments/sid/a.jpeg')
  })

  it('remaps Windows-mangled Android paths', () => {
    expect(
      remapAttachmentPathToStorageRoot(
        'D:/storage/emulated/0/Baishou-Love/Personal/Attachments/sid/a.jpeg',
        root
      )
    ).toBe('D:/Baishou-Love/Personal/Attachments/sid/a.jpeg')
  })

  it('keeps paths already under storage root', () => {
    const local = 'D:/Baishou-Love/Personal/Attachments/sid/a.jpeg'
    expect(remapAttachmentPathToStorageRoot(local, root)).toBe(local)
  })

  it('remaps file:// Android URIs', () => {
    expect(
      remapAttachmentPathToStorageRoot(
        'file:///storage/emulated/0/Baishou-Love/Personal/Attachments/sid/a.jpeg',
        root
      )
    ).toBe('D:/Baishou-Love/Personal/Attachments/sid/a.jpeg')
  })
})
