export type TtsPlaybackStopHandler = () => void | Promise<void>

const stopHandlers = new Set<TtsPlaybackStopHandler>()
let playbackGeneration = 0

/** 全局朗读代际；合成/播放流程可用此值判断是否已被更新的朗读抢占。 */
export function getTtsPlaybackGeneration(): number {
  return playbackGeneration
}

/** 注册停止回调（各端 useTts 在挂载时注册，卸载时取消）。 */
export function registerTtsPlaybackStopHandler(handler: TtsPlaybackStopHandler): () => void {
  stopHandlers.add(handler)
  return () => {
    stopHandlers.delete(handler)
  }
}

/** 停止所有已注册的朗读实例（Agent、日记等互斥）。 */
export async function stopAllTtsPlayback(): Promise<void> {
  playbackGeneration += 1
  const handlers = [...stopHandlers]
  await Promise.all(
    handlers.map(async (handler) => {
      try {
        await handler()
      } catch {
        // 单个 handler 失败不阻塞其余停止逻辑
      }
    })
  )
}
