import { isNoOutputGeneratedError } from '../agent/no-output-generated-error.util'

export type ProviderTurnStreamLike = {
  // await 只需要 then；上游 StreamTextResult.response 是 PromiseLike，不能要求 catch/finally
  response?: PromiseLike<{ messages?: unknown[] } | undefined>
  messages?: unknown[] | Promise<unknown[] | undefined>
}

/** 读出下一轮要交给模型的 messages；只有工具没有正文时 SDK 可能抛空输出，不能当成续跑失败 */
export async function readProviderTurnMessages(
  streamResult: ProviderTurnStreamLike
): Promise<unknown[] | null> {
  try {
    const response = await streamResult.response
    const next = response?.messages
    if (Array.isArray(next) && next.length > 0) return next
  } catch (error) {
    if (!isNoOutputGeneratedError(error)) throw error
  }

  const fallback = await Promise.resolve(streamResult.messages)
  if (Array.isArray(fallback) && fallback.length > 0) return fallback
  return null
}
