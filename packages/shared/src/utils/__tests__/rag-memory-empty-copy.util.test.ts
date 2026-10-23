import { describe, expect, it } from 'vitest'
import { resolveRagMemoryEmptyCopy } from '../rag-memory-empty-copy.util'

describe('resolveRagMemoryEmptyCopy', () => {
  it('should explain how memories appear when the list is empty', () => {
    expect(resolveRagMemoryEmptyCopy({ searchQuery: '', sourceKind: 'all' })).toEqual({
      titleKey: 'common.no_content',
      titleFallback: '暂无内容',
      descKey: 'settings.rag_empty_desc',
      descFallback: '写下日记、添加手动片段，或完成伙伴与节点的嵌入后，可检索的记忆会出现在这里。'
    })
  })

  it('should hint to change the query when search has no matches', () => {
    expect(resolveRagMemoryEmptyCopy({ searchQuery: '  关键词  ', sourceKind: 'all' })).toEqual({
      titleKey: 'common.no_search_result',
      titleFallback: '没有找到相关结果',
      descKey: 'settings.rag_empty_search',
      descFallback: '换个关键词试试，也可以切换语义搜索和文本搜索。'
    })
  })

  it('should use the kind-only copy when a filter has no entries', () => {
    expect(resolveRagMemoryEmptyCopy({ searchQuery: '', sourceKind: 'diary' })).toEqual({
      titleKey: 'settings.rag_empty_kind',
      titleFallback: '还没有这类记忆片段',
      descKey: 'settings.rag_empty_kind_desc',
      descFallback: '这类来源完成嵌入后会出现在这里。'
    })
  })
})
