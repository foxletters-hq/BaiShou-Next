import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Tiktoken } from 'js-tiktoken/lite'
import cl100kBase from 'js-tiktoken/ranks/cl100k_base'
import { describe, expect, it } from 'vitest'
import {
  CHUNK_OVERLAP_TOKENS,
  countCl100kTokens,
  EMBEDDING_CHUNKER_ID,
  MAX_CHUNK_TOKENS,
  splitTextIntoChunks
} from '../embedding-chunk'

const chunkDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopSrc = readFileSync(join(chunkDir, 'embedding-chunk.ts'), 'utf8')
const nativePath = join(chunkDir, 'embedding-chunk.native.ts')

function textBetweenTokens(minExclusive: number, maxInclusive: number): string {
  const enc = new Tiktoken(cl100kBase)
  let lo = 1
  let hi = maxInclusive * 4
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const text = 'x '.repeat(mid)
    const count = enc.encode(text).length
    if (count <= minExclusive) lo = mid + 1
    else if (count > maxInclusive) hi = mid - 1
    else return text
  }
  throw new Error(`cannot build text in (${minExclusive}, ${maxInclusive}] tokens`)
}

function textExceedingTokens(minTokens: number): string {
  return 'x '.repeat(minTokens * 4)
}

describe('embedding-chunk window', () => {
  it('should share js-tiktoken cl100k_base on desktop and mobile', () => {
    expect(MAX_CHUNK_TOKENS).toBe(2048)
    expect(CHUNK_OVERLAP_TOKENS).toBe(128)
    expect(EMBEDDING_CHUNKER_ID).toBe('tiktoken-2048-128')
    expect(desktopSrc).toContain("from 'js-tiktoken/lite'")
    expect(desktopSrc).toContain("from 'js-tiktoken/ranks/cl100k_base'")
    expect(desktopSrc).not.toContain("from 'tiktoken'")
    expect(desktopSrc).not.toContain('CHARS_PER_TOKEN')
    expect(existsSync(nativePath)).toBe(false)
  })

  it('should keep text that used to exceed 1024 tokens in one chunk', () => {
    const text = textBetweenTokens(1024, MAX_CHUNK_TOKENS)
    expect(countCl100kTokens(text)).toBeGreaterThan(1024)
    expect(countCl100kTokens(text)).toBeLessThanOrEqual(MAX_CHUNK_TOKENS)
    const chunks = splitTextIntoChunks(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe(text)
  })

  it('should still split longer text with overlap', () => {
    const text = textExceedingTokens(MAX_CHUNK_TOKENS)
    const chunks = splitTextIntoChunks(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]?.index).toBe(0)
    expect(chunks[1]?.index).toBe(1)
    expect(chunks[0]?.text.length).toBeGreaterThan(0)
    expect(chunks[1]?.text.length).toBeGreaterThan(0)
  })

  it('should round-trip chinese text through cl100k_base', () => {
    const text = '笔记本向量切片用同一套分词。'
    const chunks = splitTextIntoChunks(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe(text)
    expect(countCl100kTokens(text)).toBeGreaterThan(0)
  })
})
