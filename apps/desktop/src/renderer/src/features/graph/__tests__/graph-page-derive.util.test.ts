import { describe, expect, it } from 'vitest'
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  defaultGraphMonthRange
} from '@baishou/shared'
import {
  buildGraphQueueByPath,
  buildGraphSelfPersonAliases,
  filterGraphSearchHits,
  findGraphPageNode,
  findGraphSelfPersonHit,
  graphExtractAlreadyQueued,
  graphExtractErrorCopy,
  graphExtractRequestedPaths,
  graphPagePhaseKey,
  graphProfileFormFromAwaken,
  graphSearchErrorCopy,
  graphSearchHitViewState,
  graphTokenCountDisplay,
  parseGraphSourceDate,
  shouldShowGraphEmptyGuide,
  shouldShowGraphMonthEmpty
} from '../graph-page-derive.util'

describe('parseGraphSourceDate', () => {
  it('should extract an embedded ISO date and treat empty input as no date', () => {
    expect(parseGraphSourceDate('note/2024-03-08.md#L12')).toEqual({
      raw: 'note/2024-03-08.md#L12',
      date: '2024-03-08'
    })
    expect(parseGraphSourceDate('  ')).toEqual({ raw: '', date: null })
    expect(parseGraphSourceDate('2024-03-08')).toEqual({ raw: '2024-03-08', date: '2024-03-08' })
    expect(parseGraphSourceDate('no-date-here')).toEqual({ raw: 'no-date-here', date: null })
  })
})

describe('filterGraphSearchHits / graphSearchHitViewState', () => {
  it('should drop rejected or id-less hits', () => {
    expect(
      filterGraphSearchHits([
        { id: 'ok', reviewStatus: 'approved' },
        { id: 'bad', reviewStatus: 'rejected' },
        { reviewStatus: 'approved' }
      ]).map((item) => item.id)
    ).toEqual(['ok'])
  })

  it('should pin the neighborhood when there are hits and clear it when empty', () => {
    const hits = [{ id: 'a' }, { id: 'b' }]
    expect(graphSearchHitViewState(hits)).toEqual({
      highlightIds: ['a', 'b'],
      localView: { nodes: hits, edges: [] },
      pinNeighborhood: true,
      locateIds: ['a', 'b']
    })
    expect(graphSearchHitViewState([])).toEqual({
      highlightIds: [],
      localView: null,
      pinNeighborhood: false,
      locateIds: null
    })
  })
})

describe('queue helpers', () => {
  it('should index queue items by the normalized file path', () => {
    const map = buildGraphQueueByPath([
      { filePath: 'D:/Diary/A.md', status: 'pending' },
      { filePath: 'D:/Diary/B.md', status: 'running' }
    ])
    expect(map.get(Array.from(map.keys())[0]!)?.status).toBe('pending')
    expect(map.size).toBe(2)
  })

  it('should detect an already busy path and build the requested path list', () => {
    const map = buildGraphQueueByPath([{ filePath: 'a.md', status: 'running' }])
    expect(graphExtractAlreadyQueued(['a.md'], map)).toBe(true)
    expect(graphExtractAlreadyQueued(['b.md'], map)).toBe(false)
    expect(graphExtractRequestedPaths(['x.md'], [{ filePath: 'y.md' }])).toEqual(['x.md'])
    expect(graphExtractRequestedPaths(undefined, [{ filePath: 'y.md' }])).toEqual(['y.md'])
  })
})

describe('empty / phase flags', () => {
  it('should show the empty guide only on the default month range with extractable diaries', () => {
    const monthRange = defaultGraphMonthRange()
    expect(
      shouldShowGraphEmptyGuide({
        selfNameReady: true,
        dismissGuide: false,
        canvasNodeCount: 0,
        estimate: {
          entryCount: 3,
          estimatedTokens: 1,
          estimatedMinutesLow: 1,
          estimatedMinutesHigh: 2
        },
        pendingReextractCount: 0,
        monthRange
      })
    ).toBe(true)
    expect(
      shouldShowGraphEmptyGuide({
        selfNameReady: true,
        dismissGuide: false,
        canvasNodeCount: 0,
        estimate: null,
        pendingReextractCount: 0,
        monthRange
      })
    ).toBe(false)
    expect(
      shouldShowGraphEmptyGuide({
        selfNameReady: true,
        dismissGuide: true,
        canvasNodeCount: 0,
        estimate: {
          entryCount: 3,
          estimatedTokens: 1,
          estimatedMinutesLow: 1,
          estimatedMinutesHigh: 2
        },
        pendingReextractCount: 0,
        monthRange
      })
    ).toBe(false)
  })

  it('should show the month-empty overlay when the guide is hidden and the neighborhood is not pinned', () => {
    expect(
      shouldShowGraphMonthEmpty({
        selfNameReady: true,
        showEmptyGuide: false,
        canvasNodeCount: 0,
        pinNeighborhood: false
      })
    ).toBe(true)
    expect(
      shouldShowGraphMonthEmpty({
        selfNameReady: true,
        showEmptyGuide: true,
        canvasNodeCount: 0,
        pinNeighborhood: false
      })
    ).toBe(false)
    expect(
      shouldShowGraphMonthEmpty({
        selfNameReady: true,
        showEmptyGuide: false,
        canvasNodeCount: 0,
        pinNeighborhood: true
      })
    ).toBe(false)
  })

  it('should pick boot / awaken / main from the gate flags', () => {
    expect(graphPagePhaseKey({ awakenPending: true, showAwakenGate: false })).toBe('boot')
    expect(graphPagePhaseKey({ awakenPending: false, showAwakenGate: true })).toBe('awaken')
    expect(graphPagePhaseKey({ awakenPending: false, showAwakenGate: false })).toBe('main')
  })
})

describe('graphTokenCountDisplay', () => {
  it('should switch to the wan unit at 10000 tokens', () => {
    expect(graphTokenCountDisplay(9999)).toEqual({
      key: 'graph.tokens_count',
      fallback: '约 {{n}}',
      params: { n: 9999 }
    })
    expect(graphTokenCountDisplay(10000)).toEqual({
      key: 'graph.tokens_wan',
      fallback: '约 {{n}} 万',
      params: { n: '1.0' }
    })
  })
})

describe('profile helpers', () => {
  it('should blank a default nickname and keep a custom one', () => {
    expect(
      graphProfileFormFromAwaken({
        nickname: '白守用户',
        birthday: ' 1990-01-01 ',
        gender: 'male',
        avatarPath: null,
        activePersonaId: '默认身份卡',
        personas: {}
      })
    ).toEqual({ nickname: '', birthday: '1990-01-01', gender: 'male' })
    expect(
      graphProfileFormFromAwaken({
        nickname: '阿守',
        birthday: '',
        avatarPath: null,
        activePersonaId: '默认身份卡',
        personas: {}
      })
    ).toEqual({ nickname: '阿守', birthday: '', gender: '' })
  })

  it('should match the self person by name or alias and rebuild aliases without the new name', () => {
    expect(findGraphSelfPersonHit([{ name: '旧' }], '旧')?.name).toBe('旧')
    expect(findGraphSelfPersonHit([{ name: 'X', aliases: ['旧'] }], '旧')?.name).toBe('X')
    expect(findGraphSelfPersonHit([{ name: 'X', aliases: '旧' }], '旧')).toBeUndefined()
    expect(buildGraphSelfPersonAliases(['旧', '别名', '新'], '旧', '新')).toEqual(['旧', '别名'])
  })
})

describe('error copy', () => {
  it('should map known extract errors and leave unknown messages to the caller', () => {
    expect(graphExtractErrorCopy(GRAPH_SELF_NAME_REQUIRED_ERROR)?.key).toBe(
      'graph.self_name_required'
    )
    expect(graphExtractErrorCopy(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)?.key).toBe(
      'graph.extract_embedding_required'
    )
    expect(graphExtractErrorCopy(GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR)?.key).toBe(
      'graph.extract_diary_not_embedded'
    )
    expect(graphExtractErrorCopy('boom')).toBeNull()
  })

  it('should map semantic-search embedding errors and stringify other failures', () => {
    expect(graphSearchErrorCopy(new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR))).toEqual({
      key: 'graph.search_embedding_required',
      fallback: '请先配置嵌入模型，才能用语义搜索节点'
    })
    expect(graphSearchErrorCopy(new Error('offline'))).toEqual({ raw: 'offline' })
    expect(graphSearchErrorCopy(12)).toEqual({ raw: '12' })
  })
})

describe('findGraphPageNode', () => {
  it('should prefer the global list and fall back to pending nodes', () => {
    expect(findGraphPageNode('p', [{ id: 'a' }], [{ id: 'p', name: '待审' }])).toEqual({
      id: 'p',
      name: '待审'
    })
    expect(findGraphPageNode('missing', [{ id: 'a' }], [])).toBeNull()
  })
})
