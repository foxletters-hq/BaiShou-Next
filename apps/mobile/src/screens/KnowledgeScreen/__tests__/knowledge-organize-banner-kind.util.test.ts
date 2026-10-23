import { describe, expect, it } from 'vitest'
import {
  knowledgeOrganizeBannerKind,
  knowledgeOrganizeSourceCount
} from '../knowledge-organize-banner.util'

describe('knowledgeOrganizeBannerKind', () => {
  it('should show paused when leftover jobs are only queued after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should show paused when leftover graph jobs are only queued after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [{ status: 'pending' }],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should show running after the user starts organize while jobs are still queued', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('running')
  })

  it('should stay idle when watching but no queued or live work remains', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toBe('idle')
  })

  it('should show failed when ingest jobs failed after organize', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe('failed')
  })

  it('should keep failed leftover jobs visible after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe('failed')
  })

  it('should show paused after restart when leftover source is still embedding', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: false,
        ingestingCount: 1,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should stay idle when leftover embed progress belongs to a finished source', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: { a: { page: 1, total: 1, phase: 'embed' } }
      })
    ).toBe('idle')
  })

  it('should count ingest jobs when the banner has no graph rows yet', () => {
    expect(
      knowledgeOrganizeSourceCount({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ sourceId: 'a' }, { sourceId: 'a' }],
        ocrProgressBySource: {}
      })
    ).toBe(1)
  })
})
