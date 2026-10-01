import { describe, expect, it } from 'vitest'
import type { AssistantDisplayTimelineItem } from '@baishou/shared'
import { resolveNativeAssistantTimelineItems } from '../useNativeAssistantTimeline'

const live: AssistantDisplayTimelineItem[] = [{ kind: 'reasoning', key: 'live', text: 'live' }]
const persisted: AssistantDisplayTimelineItem[] = [{ kind: 'text', key: 'old', text: 'old' }]

describe('resolveNativeAssistantTimelineItems', () => {
  it('should keep an empty live timeline during overlay instead of flashing persisted parts', () => {
    expect(resolveNativeAssistantTimelineItems(true, [], persisted)).toEqual([])
  })

  it('should use live items when overlay is on and the live timeline has content', () => {
    expect(resolveNativeAssistantTimelineItems(true, live, persisted)).toEqual(live)
  })

  it('should use persisted parts when overlay is off', () => {
    expect(resolveNativeAssistantTimelineItems(false, live, persisted)).toEqual(persisted)
  })
})
