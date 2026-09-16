import { describe, expect, it } from 'vitest'
import {
  GRAPH_UNKNOWN_NODE_NAME,
  buildGraphNodeNameMap,
  collectGraphEdgeEndpointIds,
  resolveGraphNodeDisplayName
} from '../graph-pending-names.util'

describe('graph pending display names', () => {
  it('collects unique endpoint ids and skips blanks', () => {
    expect(
      collectGraphEdgeEndpointIds([
        { fromId: 'n1', toId: 'n2' },
        { fromId: 'n2', toId: 'n3' },
        { fromId: '', toId: '  ' },
        { fromId: null, toId: 'n1' }
      ])
    ).toEqual(['n1', 'n2', 'n3'])
  })

  it('resolves names and falls back to the unknown label', () => {
    const nameById = buildGraphNodeNameMap([
      { id: 'n1', name: '海边小屋' },
      { id: 'n2', name: '  ' },
      { id: '', name: '丢弃' }
    ])
    expect(nameById.get('n1')).toBe('海边小屋')
    expect(nameById.has('n2')).toBe(false)
    expect(resolveGraphNodeDisplayName(nameById, 'n1')).toBe('海边小屋')
    expect(resolveGraphNodeDisplayName(nameById, 'missing')).toBe(GRAPH_UNKNOWN_NODE_NAME)
    expect(resolveGraphNodeDisplayName(nameById, 'missing', '未找到')).toBe('未找到')
  })
})
