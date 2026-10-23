import { Tiktoken } from 'js-tiktoken/lite'
import cl100kBase from 'js-tiktoken/ranks/cl100k_base'
import type { ChunkResult } from './embedding.types'

/** 两端共用纯 JS cl100k_base 切片，避免手机无法加载 WASM 分词。 */

export const MAX_CHUNK_TOKENS = 2048
export const CHUNK_OVERLAP_TOKENS = 128
export const EMBEDDING_CHUNKER_ID = `tiktoken-${MAX_CHUNK_TOKENS}-${CHUNK_OVERLAP_TOKENS}`

let encoder: Tiktoken | null = null

function getCl100kEncoder(): Tiktoken {
  if (!encoder) encoder = new Tiktoken(cl100kBase)
  return encoder
}

export function countCl100kTokens(text: string): number {
  if (!text) return 0
  return getCl100kEncoder().encode(text).length
}

export function splitTextIntoChunks(text: string): ChunkResult[] {
  const enc = getCl100kEncoder()
  const tokens = enc.encode(text)
  const max = MAX_CHUNK_TOKENS
  const overlap = CHUNK_OVERLAP_TOKENS

  if (tokens.length <= max) {
    return [{ index: 0, text }]
  }

  const chunks: ChunkResult[] = []
  let start = 0
  let index = 0
  while (start < tokens.length) {
    let end = start + max
    if (end > tokens.length) end = tokens.length

    chunks.push({ index, text: enc.decode(tokens.slice(start, end)) })

    if (end >= tokens.length) break

    start = end - overlap
    if (start >= tokens.length) break
    index++
  }

  return chunks
}

export function normalizeEmbeddingVector(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}
