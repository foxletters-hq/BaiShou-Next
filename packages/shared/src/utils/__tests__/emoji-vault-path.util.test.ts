import { describe, expect, it } from 'vitest'
import {
  emojiVaultKeyToAttachmentsRelativePath,
  isEmojiVaultRelativePath
} from '../emoji-vault-path.util'

describe('emojiVaultKeyToAttachmentsRelativePath', () => {
  it('maps emojis/foo.png to Attachments/emojis/foo.png', () => {
    expect(emojiVaultKeyToAttachmentsRelativePath('emojis/cat.png')).toBe(
      'Attachments/emojis/cat.png'
    )
  })

  it('maps local:///emojis/foo.png to Attachments/emojis/foo.png', () => {
    expect(emojiVaultKeyToAttachmentsRelativePath('local:///emojis/cat.png')).toBe(
      'Attachments/emojis/cat.png'
    )
  })

  it('keeps already-qualified Attachments/emojis paths', () => {
    expect(emojiVaultKeyToAttachmentsRelativePath('Attachments/emojis/cat.png')).toBe(
      'Attachments/emojis/cat.png'
    )
  })
})

describe('isEmojiVaultRelativePath', () => {
  it('detects emoji vault keys and local protocol paths', () => {
    expect(isEmojiVaultRelativePath('emojis/cat.png')).toBe(true)
    expect(isEmojiVaultRelativePath('local:///emojis/cat.png')).toBe(true)
    expect(isEmojiVaultRelativePath('Attachments/session/a.png')).toBe(false)
  })
})
