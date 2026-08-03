import { describe, expect, it } from 'vitest'
import { resolveAgentGateToolMetadata } from '../agent-gate-tool-metadata'

describe('graph_upsert gate prepare', () => {
  it('parses JSON-string entities/edges before counting', async () => {
    const meta = resolveAgentGateToolMetadata('graph_upsert')
    expect(meta?.prepare).toBeTypeOf('function')
    const prepared = await meta!.prepare!(
      {
        summary: '记一次旅行',
        entities: JSON.stringify([{ name: '小明', type: 'person' }, { name: '杭州', type: 'place' }]),
        edges: JSON.stringify([{ from: '小明', to: '杭州', type: 'visited' }])
      },
      {}
    )
    expect(prepared.preview).toMatchObject({
      type: 'content',
      counts: { entities: 2, edges: 1 }
    })
    const lines = (prepared.preview as { detailLines?: string[] }).detailLines ?? []
    expect(lines.some((l) => l.includes('实体 2'))).toBe(true)
    expect(lines.some((l) => l.includes('小明'))).toBe(true)
  })

  it('counts zero when entities is neither array nor JSON array', async () => {
    const meta = resolveAgentGateToolMetadata('graph_upsert')
    const prepared = await meta!.prepare!({ summary: 'x', entities: 'not-json', edges: null }, {})
    expect(prepared.preview).toMatchObject({
      counts: { entities: 0, edges: 0 }
    })
  })
})
