import { describe, expect, it } from 'vitest'
import {
  MEMORY_ONBOARDING_DISMISSED_KEY,
  persistMemoryOnboardingDismissed,
  buildMemoryOnboardingModel,
  memoryCenterTabFromPath,
  resolveMemoryOnboardingLaunch,
  resolveMemoryOrganizeAction,
  shouldShowMemoryOnboarding
} from '../memory-center-tab.util'

describe('memoryCenterTabFromPath', () => {
  it('defaults /memory to vectors and keeps explicit graph paths', () => {
    expect(memoryCenterTabFromPath('/memory')).toBe('vectors')
    expect(memoryCenterTabFromPath('/memory/')).toBe('vectors')
    expect(memoryCenterTabFromPath('/memory/graph')).toBe('graph')
  })

  it('maps /memory/vectors to vectors', () => {
    expect(memoryCenterTabFromPath('/memory/vectors')).toBe('vectors')
  })

  it('falls back to vectors for unknown segments', () => {
    expect(memoryCenterTabFromPath('/memory/unknown')).toBe('vectors')
    expect(memoryCenterTabFromPath('/elsewhere')).toBe('vectors')
  })
})

describe('shouldShowMemoryOnboarding', () => {
  it('hides when embedding is configured and both backlogs are empty', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: false,
        embeddingConfigured: true,
        unindexedDiaryCount: 0,
        pendingGraphCount: 0
      })
    ).toBe(false)
  })

  it('hides when dismissed even if setup is incomplete', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: true,
        embeddingConfigured: false,
        unindexedDiaryCount: 3,
        pendingGraphCount: 1
      })
    ).toBe(false)
  })

  it('still shows when only the graph backlog remains', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: false,
        embeddingConfigured: true,
        pendingEmbedCount: 0,
        pendingGraphCount: 1
      })
    ).toBe(true)
  })
})

describe('buildMemoryOnboardingModel', () => {
  it('marks embedding done and does not ask to configure when a global model exists', () => {
    const model = buildMemoryOnboardingModel({
      embeddingConfigured: true,
      pendingEmbedCount: 0,
      pendingGraphCount: 1
    })
    expect(model.primaryKind).toBe('start')
    expect(model.steps).toEqual([
      { id: 'embed', status: 'done' },
      { id: 'vector', status: 'done', count: 0 },
      { id: 'graph', status: 'todo', count: 1 }
    ])
  })

  it('blocks vector and graph until the shared embedding model is configured', () => {
    const model = buildMemoryOnboardingModel({
      embeddingConfigured: false,
      pendingEmbedCount: 4,
      pendingGraphCount: 2
    })
    expect(model.primaryKind).toBe('configure')
    expect(model.steps.map((step) => step.status)).toEqual(['todo', 'blocked', 'blocked'])
  })
})

describe('resolveMemoryOnboardingLaunch', () => {
  it('starts graph organize when embedding is ready and only the graph backlog remains', () => {
    expect(
      resolveMemoryOnboardingLaunch({
        embeddingConfigured: true,
        pendingEmbedCount: 0,
        pendingGraphCount: 1
      })
    ).toBe('organize')
  })

  it('starts both index and organize when both backlogs remain', () => {
    expect(
      resolveMemoryOnboardingLaunch({
        embeddingConfigured: true,
        pendingEmbedCount: 3,
        pendingGraphCount: 2
      })
    ).toBe('index-and-organize')
  })
})

describe('resolveMemoryOrganizeAction', () => {
  it('asks to configure embedding before any organize work', () => {
    expect(
      resolveMemoryOrganizeAction({
        embeddingConfigured: false,
        pendingEmbedCount: 3,
        indexing: false
      })
    ).toBe('configure')
  })

  it('embeds first when the backlog or an in-flight batch remains, then organizes the graph', () => {
    expect(
      resolveMemoryOrganizeAction({
        embeddingConfigured: true,
        pendingEmbedCount: 1,
        indexing: false
      })
    ).toBe('embed-then-graph')
    expect(
      resolveMemoryOrganizeAction({
        embeddingConfigured: true,
        pendingEmbedCount: 0,
        indexing: true
      })
    ).toBe('embed-then-graph')
  })

  it('goes straight to graph organize when embedding is ready and nothing is pending', () => {
    expect(
      resolveMemoryOrganizeAction({
        embeddingConfigured: true,
        pendingEmbedCount: 0,
        unindexedDiaryCount: 0,
        indexing: false
      })
    ).toBe('graph')
  })
})

describe('persistMemoryOnboardingDismissed', () => {
  it('writes the fixed localStorage key', () => {
    localStorage.removeItem(MEMORY_ONBOARDING_DISMISSED_KEY)
    persistMemoryOnboardingDismissed()
    expect(MEMORY_ONBOARDING_DISMISSED_KEY).toBe('baishou.memory.onboardingDismissed.v1')
    expect(localStorage.getItem(MEMORY_ONBOARDING_DISMISSED_KEY)).toBe('1')
  })
})
