/**
 * 平台无关的 AI 流式数据及工具调用状态的事件推送接口
 */
export interface IStreamEmitter {
  sendChunk(sessionId: string, chunk: string): void
  sendReasoningChunk(sessionId: string, chunk: string): void
  sendToolStart(sessionId: string, name: string, args: unknown): void
  sendToolResult(sessionId: string, name: string, result: unknown): void
  sendFinish(sessionId: string, payload: { success?: boolean; error?: string }): void
}
