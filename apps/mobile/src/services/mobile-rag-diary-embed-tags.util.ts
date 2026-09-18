import { resolveDiaryTagsFromSources } from '@baishou/shared'

/**
 * 待嵌入检测瘦行没有 tags 列。
 * 影子索引完整行已是 string[]；日记服务回退行的 tags 仍可能是字符串或 null。
 */
export function resolveDiaryEmbedTagsFromLoadedRow(diary: {
  tags?: string[] | string | null
  content?: string
}): string[] {
  return resolveDiaryTagsFromSources(diary.tags ?? [], diary.content ?? '')
}
