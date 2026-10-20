import { describe, expect, it } from 'vitest'
import {
  alignedEmbeddingForNodeCard,
  buildEntityAlignPrompt,
  parseEntityAlignDecisions,
  parseNameCandidateDecision
} from '../graph-entity-align'

describe('alignedEmbeddingForNodeCard', () => {
  it('should return the vector when embed text equals the node card', () => {
    expect(
      alignedEmbeddingForNodeCard({ embedding: [1, 0], embedText: '小张\n同事' }, '小张', '同事')
    ).toEqual({ embedding: [1, 0], text: '小张\n同事' })
  })

  it('should return null when the node card differs', () => {
    expect(
      alignedEmbeddingForNodeCard({ embedding: [1, 0], embedText: '小张\n同事' }, '张三', '同事')
    ).toBeNull()
  })

  it('should return null when alignment did not compute a vector', () => {
    expect(alignedEmbeddingForNodeCard(undefined, '小张', '同事')).toBeNull()
    expect(
      alignedEmbeddingForNodeCard({ embedding: undefined, embedText: undefined }, '小张', '同事')
    ).toBeNull()
  })
})

describe('buildEntityAlignPrompt', () => {
  it('should include sourceContext and uncertain in the judge prompt', () => {
    const prompt = buildEntityAlignPrompt({
      incoming: [
        {
          ref: 'i1',
          name: '小张',
          nodeType: 'person',
          aliases: [],
          summary: '同事',
          sourceContext: '日记正文片段'
        }
      ],
      existing: [
        { ref: 'e1', id: 'n1', name: '张三', nodeType: 'person', aliases: [], summary: '' }
      ]
    })
    expect(prompt.user).toContain('日记正文片段')
    expect(prompt.user).toContain('sourceContext')
    expect(prompt.user).toContain('uncertain')
    expect(prompt.user).toContain('吃不准')
  })
})

describe('parseEntityAlignDecisions', () => {
  it('reads incoming/existing/same_as from the second-pass JSON', () => {
    const parsed = parseEntityAlignDecisions(
      '```json\n{"merges":[{"incoming":"i1","existing":"e1"},{"incoming":"i2","same_as":"i1"}]}\n```'
    )
    expect(parsed).toEqual({
      merges: [
        { incomingRef: 'i1', existingRef: 'e1', sameAsIncomingRef: undefined },
        { incomingRef: 'i2', existingRef: undefined, sameAsIncomingRef: 'i1' }
      ],
      uncertain: []
    })
  })

  it('should read uncertain rows from the second-pass JSON', () => {
    const parsed = parseEntityAlignDecisions(
      '{"merges":[],"uncertain":[{"incoming":"i1","existing":"e1","reason":"吃不准","similarity":0.72}]}'
    )
    expect(parsed).toEqual({
      merges: [],
      uncertain: [{ incomingRef: 'i1', existingRef: 'e1', reason: '吃不准', similarity: 0.72 }]
    })
  })

  it('returns null for extract-shaped JSON so commit creates new nodes', () => {
    expect(
      parseEntityAlignDecisions(
        JSON.stringify({
          entities: [{ name: '小张', type: 'person' }],
          edges: []
        })
      )
    ).toBeNull()
  })
})

describe('parseNameCandidateDecision', () => {
  it('should read the candidate id from the judge JSON', () => {
    expect(parseNameCandidateDecision('{"id":"node-split"}')).toBe('node-split')
    expect(parseNameCandidateDecision('```json\n{"candidateId":"node-split"}\n```')).toBe(
      'node-split'
    )
  })

  it('should return null when the model leaves the id empty', () => {
    expect(parseNameCandidateDecision('{"id":null}')).toBeNull()
    expect(parseNameCandidateDecision('{"id":""}')).toBeNull()
    expect(parseNameCandidateDecision('not-json')).toBeNull()
  })
})
