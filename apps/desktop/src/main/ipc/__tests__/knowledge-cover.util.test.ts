import { describe, expect, it } from 'vitest'
import { listNotebookCoverCandidateRels } from '../knowledge-cover.util'

describe('listNotebookCoverCandidateRels', () => {
  it('should put the recorded cover first and keep other candidates after it', () => {
    const rels = listNotebookCoverCandidateRels('nb1', 'nb1/cover.png')
    expect(rels[0]).toBe('nb1/cover.png')
    expect(rels.length).toBeGreaterThan(1)
    expect(new Set(rels).size).toBe(rels.length)
  })

  it('should return default candidates when recorded cover is empty', () => {
    const rels = listNotebookCoverCandidateRels('nb1', '')
    expect(rels.length).toBeGreaterThan(0)
    expect(rels.every((rel) => rel.includes('nb1'))).toBe(true)
  })
})
