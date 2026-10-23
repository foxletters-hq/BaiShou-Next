import { formatAiApiCallError } from './ai-api-error.util'

export const EMBED_API_PROBE_TEXT = '记忆整理连通检查'

export const EMBED_API_PROBE_FAILURE_MESSAGE =
  '嵌入接口不可用，没有写入任何向量。请检查嵌入模型的接口地址。'

export async function probeEmbeddingApi(
  embedQuery: (text: string) => Promise<number[] | null>
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const vector = await embedQuery(EMBED_API_PROBE_TEXT)
    if (vector && vector.length > 0) return { ok: true }
    return { ok: false, message: EMBED_API_PROBE_FAILURE_MESSAGE }
  } catch (error) {
    return { ok: false, message: formatAiApiCallError(error) }
  }
}
