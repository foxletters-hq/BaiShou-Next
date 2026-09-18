import { describe, expect, it } from 'vitest'
import { knowledgeSourceShowsPendingOrganizeHelp } from '../knowledge-source-status.util'

describe('knowledgeSourceShowsPendingOrganizeHelp', () => {
  it('should show help only when the source is waiting to be organized', () => {
    expect(knowledgeSourceShowsPendingOrganizeHelp('stored')).toBe(true)
    expect(knowledgeSourceShowsPendingOrganizeHelp('ready')).toBe(false)
    expect(knowledgeSourceShowsPendingOrganizeHelp('pending')).toBe(false)
  })
})
