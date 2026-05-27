import { get_encoding } from 'tiktoken'
import type { ChunkResult } from './embedding.types'

export const MAX_CHUNK_TOKENS = 1024
export const CHUNK_OVERLAP_TOKENS = 128

export function splitTextIntoChunks(text: string): ChunkResult[] {
  const enc = get_encoding('cl100k_base')
  const tokens = enc.encode(text)
  const max = MAX_CHUNK_TOKENS
  const overlap = CHUNK_OVERLAP_TOKENS

  if (tokens.length <= max) {
    enc.free()
    return [{ index: 0, text }]
  }

  const chunks: ChunkResult[] = []
  let start = 0
  let index = 0
  while (start < tokens.length) {
    let end = start + max
    if (end > tokens.length) end = tokens.length

    const chunkTokens = tokens.slice(start, end)
    const chunkText = new TextDecoder().decode(enc.decode(chunkTokens))
    chunks.push({ index, text: chunkText })

    if (end >= tokens.length) break

    start = end - overlap
    if (start >= tokens.length) break
    index++
  }

  enc.free()
  return chunks
}

export function normalizeEmbeddingVector(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}
