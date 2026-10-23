import { describe, expect, it } from 'vitest'
import {
  knowledgeSourceDisplayStatus,
  knowledgeSourceShowsPendingOrganizeHelp
} from '../knowledge-source-status.util'

describe('knowledgeSourceShowsPendingOrganizeHelp', () => {
  it('should show help only when the source is waiting to be organized', () => {
    expect(knowledgeSourceShowsPendingOrganizeHelp('stored')).toBe(true)
    expect(knowledgeSourceShowsPendingOrganizeHelp('ready')).toBe(false)
    expect(knowledgeSourceShowsPendingOrganizeHelp('pending')).toBe(false)
  })
})

describe('knowledgeSourceDisplayStatus', () => {
  it('should keep ready when no graph job remains', () => {
    expect(knowledgeSourceDisplayStatus('ready', null)).toBe('ready')
    expect(knowledgeSourceDisplayStatus('ready', undefined)).toBe('ready')
  })

  it('should not call a ready source ready while its graph job is still open', () => {
    expect(knowledgeSourceDisplayStatus('ready', 'running')).toBe('graph_organizing')
    expect(knowledgeSourceDisplayStatus('ready', 'pending')).toBe('graph_queued')
    expect(knowledgeSourceDisplayStatus('partial', 'running')).toBe('graph_organizing')
    expect(knowledgeSourceDisplayStatus('ready', 'failed')).toBe('graph_failed')
  })

  it('should leave extract and embed statuses unchanged', () => {
    expect(knowledgeSourceDisplayStatus('embedding', 'running')).toBe('embedding')
    expect(knowledgeSourceDisplayStatus('extracting', 'pending')).toBe('extracting')
  })
})
