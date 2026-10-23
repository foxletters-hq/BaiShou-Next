import { describe, expect, it } from 'vitest'
import {
  isKnowledgeGraphJobOpen,
  knowledgeOrganizeDefaultSourceId,
  knowledgeOrganizeSourceSummary,
  notebookOrganizeSourceRow
} from '../notebook-organize-source.util'

describe('notebookOrganizeSourceRow', () => {
  it('should keep extract and embed done while this source is mid graph extract', () => {
    const row = notebookOrganizeSourceRow({
      source: { id: 'pdf', title: '被讨厌的勇气', status: 'ready' },
      graphJob: {
        status: 'running',
        windowsDone: 2,
        windowsTotal: 20,
        pageFrom: 19,
        pageTo: 32,
        pageTotal: 222
      }
    })
    expect(row.phases.find((phase) => phase.id === 'extract')?.status).toBe('done')
    expect(row.phases.find((phase) => phase.id === 'embed')?.status).toBe('done')
    expect(row.phases.find((phase) => phase.id === 'graph')).toEqual(
      expect.objectContaining({
        status: 'running',
        pageFrom: 19,
        pageTo: 32,
        pageTotal: 222
      })
    )
    expect(row.phases.find((phase) => phase.id === 'graphNodes')?.status).toBe('pending')
    expect(knowledgeOrganizeSourceSummary(row.phases)).toBe('graph')
  })

  it('should show node vectors running after this source finished its windows', () => {
    const row = notebookOrganizeSourceRow({
      source: { id: 'pdf', title: '被讨厌的勇气', status: 'ready' },
      graphJob: { status: 'running', windowsDone: 20, windowsTotal: 20 }
    })
    expect(row.phases.find((phase) => phase.id === 'graph')?.status).toBe('done')
    expect(row.phases.find((phase) => phase.id === 'graphNodes')?.status).toBe('running')
    expect(knowledgeOrganizeSourceSummary(row.phases)).toBe('graphNodes')
  })

  it('should treat another ready source with a queued graph job as still organizing', () => {
    const row = notebookOrganizeSourceRow({
      source: { id: 'epub', title: '深度关系', status: 'ready' },
      graphJob: { status: 'pending' }
    })
    expect(isKnowledgeGraphJobOpen('pending')).toBe(true)
    expect(row.phases.find((phase) => phase.id === 'graph')?.status).toBe('pending')
    expect(knowledgeOrganizeSourceSummary(row.phases)).toBe('queued')
  })

  it('should keep the open source when it is still in the list', () => {
    const running = notebookOrganizeSourceRow({
      source: { id: 'pdf', title: '被讨厌的勇气', status: 'ready' },
      graphJob: { status: 'running', windowsDone: 1, windowsTotal: 4 }
    })
    const queued = notebookOrganizeSourceRow({
      source: { id: 'epub', title: '深度关系', status: 'ready' },
      graphJob: { status: 'pending' }
    })
    expect(knowledgeOrganizeDefaultSourceId([running, queued], 'epub')).toBe('epub')
    expect(knowledgeOrganizeDefaultSourceId([running, queued], null)).toBe('pdf')
  })
})
