import { describe, expect, it } from 'vitest'
import {
  clampGraphAppearanceSettings,
  collectGraphConnectedNodeIds,
  filterGraphIsolatedDisplayNodes,
  isGraphHubLabelVisible
} from '../graph-appearance-settings.util'

describe('isGraphHubLabelVisible', () => {
  it('shows name when degree reaches the threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 1,
        mentionCount: 0,
        hubLabelMinDegree: 1,
        hubLabelMinMentions: 1
      })
    ).toBe(true)
  })

  it('shows name for isolated nodes when the label switch is on', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 0,
        mentionCount: 0,
        hubLabelMinDegree: 1,
        hubLabelMinMentions: 1
      })
    ).toBe(true)
  })

  it('hides isolated-node names when the label switch is off', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 0,
        mentionCount: 8,
        hubLabelMinDegree: 1,
        hubLabelMinMentions: 1,
        showIsolatedLabels: false
      })
    ).toBe(false)
  })

  it('hides connected nodes when both degree and mentions stay below threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 1,
        mentionCount: 0,
        hubLabelMinDegree: 2,
        hubLabelMinMentions: 2
      })
    ).toBe(false)
  })

  it('defaults missing isolated-node switch to on', () => {
    expect(clampGraphAppearanceSettings({}).showIsolatedNodes).toBe(true)
    expect(clampGraphAppearanceSettings({ showIsolatedNodes: false }).showIsolatedNodes).toBe(false)
  })

  it('collects endpoints from current-view edges', () => {
    expect(
      [...collectGraphConnectedNodeIds([{ fromId: 'a', toId: 'b' }, { fromId: 'b' }])].sort()
    ).toEqual(['a', 'b'])
  })

  it('keeps isolated nodes when the switch is on', () => {
    const nodes = [{ id: 'a' }, { id: 'alone' }]
    expect(
      filterGraphIsolatedDisplayNodes(nodes, {
        showIsolatedNodes: true,
        edges: [{ fromId: 'a', toId: 'b' }]
      }).map((n) => n.id)
    ).toEqual(['a', 'alone'])
  })

  it('hides isolated nodes but keeps selected and highlighted ones', () => {
    const nodes = [{ id: 'a' }, { id: 'alone' }, { id: 'hit' }, { id: 'picked' }]
    expect(
      filterGraphIsolatedDisplayNodes(nodes, {
        showIsolatedNodes: false,
        edges: [{ fromId: 'a', toId: 'b' }],
        keepIds: ['picked', 'hit']
      }).map((n) => n.id)
    ).toEqual(['a', 'hit', 'picked'])
  })

  it('shows name when mentionCount reaches the threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 0,
        mentionCount: 1,
        hubLabelMinDegree: 3,
        hubLabelMinMentions: 1
      })
    ).toBe(true)
  })
})
