import { afterEach, describe, expect, it, vi } from 'vitest'
import { serializeVector as graphSerializeVector } from '../graph.repository.shared'
import { serializeVector as notebookSerializeVector } from '../notebook-graph.repository.shared'

/** 手机 JS 运行时没有 Buffer；向量序列化不能依赖它。 */
describe('serializeVector without Buffer (mobile runtime)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const [name, serialize] of [
    ['graph', graphSerializeVector],
    ['notebook-graph', notebookSerializeVector]
  ] as const) {
    it(`${name}: 不使用 Buffer 也能写出 float32 字节`, () => {
      vi.stubGlobal('Buffer', undefined)
      const bytes = serialize([0.5, -1.25, 3])
      expect(bytes.byteLength).toBe(12)
      const view = new Float32Array(bytes.buffer, bytes.byteOffset, 3)
      expect([...view]).toEqual([0.5, -1.25, 3])
    })
  }
})
