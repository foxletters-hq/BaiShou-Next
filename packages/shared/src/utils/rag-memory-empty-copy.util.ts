import type { RagVectorKindFilter } from './rag-vector-kind.util'

export type RagMemoryEmptyCopy = {
  titleKey: string
  titleFallback: string
  descKey: string
  descFallback: string
}

/** 向量记忆列表空状态：按搜索 / 分类筛选取文案，避免把检索误说成生成。 */
export function resolveRagMemoryEmptyCopy(input: {
  searchQuery?: string
  sourceKind?: RagVectorKindFilter
}): RagMemoryEmptyCopy {
  if (input.searchQuery?.trim()) {
    return {
      titleKey: 'common.no_search_result',
      titleFallback: '没有找到相关结果',
      descKey: 'settings.rag_empty_search',
      descFallback: '换个关键词试试，也可以切换语义搜索和文本搜索。'
    }
  }

  if (input.sourceKind && input.sourceKind !== 'all') {
    return {
      titleKey: 'settings.rag_empty_kind',
      titleFallback: '还没有这类记忆片段',
      descKey: 'settings.rag_empty_kind_desc',
      descFallback: '这类来源完成嵌入后会出现在这里。'
    }
  }

  return {
    titleKey: 'common.no_content',
    titleFallback: '暂无内容',
    descKey: 'settings.rag_empty_desc',
    descFallback: '写下日记、添加手动片段，或完成伙伴与节点的嵌入后，可检索的记忆会出现在这里。'
  }
}
