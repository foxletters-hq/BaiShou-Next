import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractDiaryAttachmentSrcs } from '../../../native/DiaryEditor/diary-image-markdown.util'
import { parseImageMarkdown, buildImageMarkdown } from '../utils/image-utils'

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('cross-platform-diary fixture (C-8)', () => {
  const content = readFileSync(resolve(fixtureDir, 'cross-platform-diary.md'), 'utf8')

  it('extracts all attachment sources from fixture', () => {
    expect(extractDiaryAttachmentSrcs(content)).toEqual([
      'attachment/pasted-2024.png',
      'attachment/before.jpg',
      'attachment/after.jpg'
    ])
  })

  it('parses width syntax on single-image line', () => {
    const line = '![screenshot](attachment/pasted-2024.png | 480)'
    const parsed = parseImageMarkdown(line)
    expect(parsed).toMatchObject({
      alt: 'screenshot',
      src: 'attachment/pasted-2024.png',
      width: 480
    })
    expect(buildImageMarkdown(parsed!.alt, parsed!.src, parsed!.width)).toBe(line)
  })

  it('round-trips images without width', () => {
    const line = '![before](attachment/before.jpg)'
    const parsed = parseImageMarkdown(line)
    expect(buildImageMarkdown(parsed!.alt, parsed!.src, parsed!.width)).toBe(line)
  })
})
