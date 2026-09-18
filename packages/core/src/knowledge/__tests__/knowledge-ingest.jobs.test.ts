import { describe, expect, it } from 'vitest'
import {
  clearGraphFollowAfterEmbed,
  markGraphFollowAfterEmbed,
  rememberProcessTargets,
  takeGraphFollowAfterEmbed,
  takeProcessTargets
} from '../knowledge-ingest.jobs'

describe('knowledge-ingest.jobs follow after embed', () => {
  it('should return true only once when the same source was marked', () => {
    markGraphFollowAfterEmbed(' src-1 ')
    expect(takeGraphFollowAfterEmbed('src-1')).toBe(true)
    expect(takeGraphFollowAfterEmbed('src-1')).toBe(false)
  })

  it('should ignore blank source ids when marking follow', () => {
    markGraphFollowAfterEmbed('   ')
    expect(takeGraphFollowAfterEmbed('')).toBe(false)
  })

  it('should drop a pending follow when it is cleared', () => {
    markGraphFollowAfterEmbed('src-2')
    clearGraphFollowAfterEmbed('src-2')
    expect(takeGraphFollowAfterEmbed('src-2')).toBe(false)
  })
})

describe('knowledge-ingest.jobs process targets', () => {
  it('should return remembered targets when a source was queued', () => {
    rememberProcessTargets('src-3', { embed: true, graph: false })
    expect(takeProcessTargets('src-3')).toEqual({ embed: true, graph: false })
  })

  it('should default both targets on when nothing was remembered', () => {
    expect(takeProcessTargets('missing-source')).toEqual({ embed: true, graph: true })
  })
})
