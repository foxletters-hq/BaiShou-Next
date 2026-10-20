import { describe, expect, it } from 'vitest'
import { knowledgeOrganizeSourcePhases } from '../knowledge-organize-banner.util'

describe('knowledgeOrganizeSourcePhases', () => {
  it('should keep queued extract waiting until the user starts organize', () => {
    const extract = knowledgeOrganizeSourcePhases({
      sourceStatus: 'pending',
      extractJobStatus: 'pending'
    }).find((phase) => phase.id === 'extract')
    expect(extract?.status).toBe('pending')
  })

  it('should keep queued extract waiting after the user starts organize', () => {
    const extract = knowledgeOrganizeSourcePhases({
      watching: true,
      sourceStatus: 'pending',
      extractJobStatus: 'pending'
    }).find((phase) => phase.id === 'extract')
    expect(extract?.status).toBe('pending')
  })

  it('should keep queued graph and embed waiting instead of marking them running', () => {
    const phases = knowledgeOrganizeSourcePhases({
      watching: true,
      sourceStatus: 'ready',
      embedJobStatus: 'pending',
      graphJobStatus: 'pending'
    })
    expect(phases.find((phase) => phase.id === 'embed')?.status).toBe('pending')
    expect(phases.find((phase) => phase.id === 'graph')?.status).toBe('pending')
  })

  it('should show the queued graph total from known windows or page count', () => {
    const fromWindows = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'pending',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'pending',
        windowsDone: 0,
        windowsTotal: 8
      }
    }).find((phase) => phase.id === 'graph')
    expect(fromWindows).toEqual({
      id: 'graph',
      status: 'pending',
      completed: 0,
      total: 8
    })
    const fromPages = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'pending',
      pageCount: 12
    }).find((phase) => phase.id === 'graph')
    expect(fromPages).toEqual({
      id: 'graph',
      status: 'pending',
      completed: 0,
      total: 12
    })
  })

  it('should show node embed counts while node vectors are still queued or running', () => {
    const phases = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 8,
        windowsTotal: 8,
        nodesDone: 3,
        nodesTotal: 15
      }
    })
    expect(phases.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'running',
      completed: 3,
      total: 15
    })
  })

  it('should not treat leftover embed progress as running when the source is already ready', () => {
    const embed = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      ingestProgress: { page: 1, total: 1, phase: 'embed' }
    }).find((phase) => phase.id === 'embed')
    expect(embed).toEqual({ id: 'embed', status: 'done', completed: 0, total: 0 })
  })

  it('should show graph window or page counts while graph extract is running', () => {
    const graph = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      ingestProgress: { page: 5, total: 20, phase: 'graph' }
    }).find((phase) => phase.id === 'graph')
    expect(graph).toEqual({
      id: 'graph',
      status: 'running',
      completed: 5,
      total: 20
    })
  })

  it('should show graph page span from the job when live ingest progress is missing', () => {
    const graph = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 2,
        windowsTotal: 8,
        pageFrom: 19,
        pageTo: 32,
        pageTotal: 222
      }
    }).find((phase) => phase.id === 'graph')
    expect(graph).toEqual({
      id: 'graph',
      status: 'running',
      completed: 32,
      total: 222,
      pageFrom: 19,
      pageTo: 32,
      pageTotal: 222
    })
  })

  it('should keep leftover embed waiting after restart until the user continues', () => {
    const embed = knowledgeOrganizeSourcePhases({
      watching: false,
      sourceStatus: 'embedding',
      embedJobStatus: 'pending'
    }).find((phase) => phase.id === 'embed')
    expect(embed?.status).toBe('pending')
  })

  it('should show embed chunk counts while embedding is running', () => {
    const embed = knowledgeOrganizeSourcePhases({
      sourceStatus: 'embedding',
      embedJobStatus: 'running',
      ingestProgress: { page: 12, total: 48, phase: 'embed' }
    }).find((phase) => phase.id === 'embed')
    expect(embed).toEqual({
      id: 'embed',
      status: 'running',
      completed: 12,
      total: 48
    })
  })

  it('should keep graph extract running with its total until node counts exist', () => {
    const phases = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      pageCount: 12,
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 1,
        windowsTotal: 1
      }
    })
    expect(phases.find((phase) => phase.id === 'graph')).toEqual({
      id: 'graph',
      status: 'running',
      completed: 1,
      total: 1
    })
    expect(phases.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'pending',
      completed: 0,
      total: 0
    })
    const stillExtracting = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 3,
        windowsTotal: 8,
        nodesDone: 2,
        nodesTotal: 4
      }
    })
    expect(stillExtracting.find((phase) => phase.id === 'graph')?.status).toBe('running')
    expect(stillExtracting.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'running',
      completed: 2,
      total: 4
    })
    const fromPages = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      pageCount: 12
    }).find((phase) => phase.id === 'graph')
    expect(fromPages).toEqual({
      id: 'graph',
      status: 'running',
      completed: 0,
      total: 12
    })
  })
})
