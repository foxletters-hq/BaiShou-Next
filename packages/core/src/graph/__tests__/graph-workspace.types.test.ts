import { describe, expect, it } from 'vitest'
import type { GraphWorkspaceIdentity } from '../graph-workspace.types'

describe('GraphWorkspaceIdentity', () => {
  it('should lock the shared ports both graph workspaces must implement', () => {
    const identity: GraphWorkspaceIdentity = {
      kind: 'notebook',
      forbiddenAnchorTypes: ['source'],
      nodeIdForEntity(type, name, discriminator) {
        return `${type}:${name}:${discriminator ?? ''}`
      }
    }
    expect(Object.keys(identity).sort()).toEqual([
      'forbiddenAnchorTypes',
      'kind',
      'nodeIdForEntity'
    ])
    expect(identity.nodeIdForEntity('person', '甲', '同事')).toBe('person:甲:同事')
  })
})
