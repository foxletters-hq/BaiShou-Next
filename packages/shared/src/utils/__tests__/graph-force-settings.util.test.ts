import { describe, expect, it } from 'vitest'
import {
  GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE,
  GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN,
  GRAPH_FORCE_CENTER_MOVE_EPS,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_FORCE_ISOLATED_CENTER_SCALE,
  GRAPH_FORCE_ISOLATED_CHARGE_SCALE,
  GRAPH_FORCE_ISOLATED_SEED,
  GRAPH_FORCE_MIXED_CHARGE_SCALE,
  clampGraphForceSettings,
  countIsolatedGraphForceNodes,
  graphForceCenterNeedsUpdate,
  graphForceChargeDistanceMax,
  graphForcePairChargeScale,
  graphForcePairUsesDistanceMax,
  graphForceIsolatedSeedOffset,
  graphForceIsolatedSeedSpread,
  graphForceNodeCenterStrength,
  graphForceNodeChargeStrength
} from '../graph-force-settings.util'

describe('graphForceNodeChargeStrength', () => {
  it('should keep the configured charge when the node has edges', () => {
    expect(graphForceNodeChargeStrength(-180, 1)).toBe(-180)
    expect(graphForceNodeChargeStrength(-180, 8)).toBe(-180)
  })

  it('should weaken charge when the node has no edges', () => {
    expect(graphForceNodeChargeStrength(-180, 0)).toBe(-180 * GRAPH_FORCE_ISOLATED_CHARGE_SCALE)
    expect(graphForceNodeChargeStrength(GRAPH_FORCE_DEFAULTS.chargeStrength, 0)).toBeGreaterThan(
      GRAPH_FORCE_DEFAULTS.chargeStrength
    )
  })
})

describe('graphForceNodeCenterStrength', () => {
  it('should keep the configured center pull when the node has edges', () => {
    expect(graphForceNodeCenterStrength(0.08, 2)).toBe(0.08)
  })

  it('should weaken center pull when the node has no edges', () => {
    expect(graphForceNodeCenterStrength(0.08, 0)).toBe(0.08 * GRAPH_FORCE_ISOLATED_CENTER_SCALE)
    expect(graphForceNodeCenterStrength(0.08, 0)).toBeLessThan(0.08)
    expect(graphForceNodeCenterStrength(0.08, 0)).toBeGreaterThan(0)
  })
})

describe('graphForceIsolatedSeedSpread', () => {
  it('should grow with isolated count and stay inside the seed band', () => {
    const few = graphForceIsolatedSeedSpread(4)
    const many = graphForceIsolatedSeedSpread(200)
    expect(few).toBeGreaterThanOrEqual(GRAPH_FORCE_ISOLATED_SEED.min)
    expect(many).toBeGreaterThan(few)
    expect(many).toBeLessThanOrEqual(GRAPH_FORCE_ISOLATED_SEED.max)
  })
})

describe('graphForceIsolatedSeedOffset', () => {
  it('should scatter a node on a disk instead of a thin ring', () => {
    const offset = graphForceIsolatedSeedOffset(16, () => 0.25)
    const radius = Math.hypot(offset.dx, offset.dy)
    const spread = graphForceIsolatedSeedSpread(16)
    expect(radius).toBeGreaterThan(0)
    expect(radius).toBeLessThanOrEqual(spread)
  })
})

describe('graphForcePairChargeScale', () => {
  it('should keep full charge between connected nodes', () => {
    expect(graphForcePairChargeScale(2, 3)).toBe(1)
  })

  it('should use isolate scale between two isolated nodes', () => {
    expect(graphForcePairChargeScale(0, 0)).toBe(GRAPH_FORCE_ISOLATED_CHARGE_SCALE)
  })

  it('should almost ignore charge between an isolated node and the cluster', () => {
    expect(graphForcePairChargeScale(0, 4)).toBe(GRAPH_FORCE_MIXED_CHARGE_SCALE)
    expect(graphForcePairChargeScale(1, 0)).toBe(GRAPH_FORCE_MIXED_CHARGE_SCALE)
  })
})

describe('graphForcePairUsesDistanceMax', () => {
  it('should not cap isolate-to-isolate repulsion', () => {
    expect(graphForcePairUsesDistanceMax(0, 0)).toBe(false)
    expect(graphForcePairUsesDistanceMax(2, 0)).toBe(true)
    expect(graphForcePairUsesDistanceMax(1, 3)).toBe(true)
  })
})

describe('graphForceCenterNeedsUpdate', () => {
  it('should ignore sub-pixel center drift', () => {
    expect(graphForceCenterNeedsUpdate({ x: 10, y: 20 }, { x: 10.2, y: 20.1 })).toBe(false)
    expect(
      graphForceCenterNeedsUpdate({ x: 10, y: 20 }, { x: 10 + GRAPH_FORCE_CENTER_MOVE_EPS, y: 20 })
    ).toBe(true)
    expect(graphForceCenterNeedsUpdate(null, { x: 0, y: 0 })).toBe(true)
  })
})

describe('graphForceChargeDistanceMax', () => {
  it('should keep nearby repulsion and ignore long-range blast', () => {
    expect(graphForceChargeDistanceMax(70)).toBe(GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN)
    expect(graphForceChargeDistanceMax(120)).toBe(120 * GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE)
  })
})

describe('countIsolatedGraphForceNodes', () => {
  it('should count nodes whose degree is missing or zero', () => {
    expect(
      countIsolatedGraphForceNodes(
        ['a', 'b', 'c'],
        new Map([
          ['a', 2],
          ['c', 0]
        ])
      )
    ).toBe(2)
  })
})

describe('clampGraphForceSettings', () => {
  it('should fill missing fields from defaults', () => {
    expect(clampGraphForceSettings({})).toEqual({ ...GRAPH_FORCE_DEFAULTS })
  })
})
