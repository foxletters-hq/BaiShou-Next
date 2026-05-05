/**
 * 统一的流式 Chunk 类型系统
 * 
 * 替代原来在 consumeAndPersistStream 里散落的 if/else 判断，
 * 将 Vercel AI SDK 的 TextStreamPart 映射为应用层标准化的 Chunk 类型。
 * 
 * 不做过度封装——底层仍然是 Vercel AI SDK 原生能力。
 */

// ─── Chunk 类型枚举 ───

export enum ChunkType {
  /** 文本增量 */
  TEXT_DELTA = 'text-delta',

  /** 深度思考增量 (DeepSeek-R1 / QwQ / Gemini Thinking 等) */
  REASONING_DELTA = 'reasoning-delta',

  /** 工具被调用 */
  TOOL_CALL = 'tool-call',

  /** 工具返回结果 */
  TOOL_RESULT = 'tool-result',

  /** 流遇到错误 */
  ERROR = 'error',

  /** 流被用户中止 */
  ABORT = 'abort',

  /** 单步完成 (stopWhen/stepCountIs 下每一步结束时触发) */
  STEP_FINISH = 'step-finish',

  /** 整个流完成 */
  FINISH = 'finish',
}

// ─── Chunk 联合类型 ───

export interface TextDeltaChunk {
  type: ChunkType.TEXT_DELTA;
  text: string;
}

export interface ReasoningDeltaChunk {
  type: ChunkType.REASONING_DELTA;
  text: string;
}

export interface ToolCallChunk {
  type: ChunkType.TOOL_CALL;
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultChunk {
  type: ChunkType.TOOL_RESULT;
  toolCallId: string;
  toolName: string;
  output: unknown;
}

export interface ErrorChunk {
  type: ChunkType.ERROR;
  error: unknown;
}

export interface AbortChunk {
  type: ChunkType.ABORT;
}

export interface StepFinishChunk {
  type: ChunkType.STEP_FINISH;
  finishReason: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface FinishChunk {
  type: ChunkType.FINISH;
  usage?: { inputTokens: number; outputTokens: number };
}

export type StreamChunk =
  | TextDeltaChunk
  | ReasoningDeltaChunk
  | ToolCallChunk
  | ToolResultChunk
  | ErrorChunk
  | AbortChunk
  | StepFinishChunk
  | FinishChunk;

// ─── 性能指标 ───

export interface StreamMetrics {
  /** 首 Token 延迟 (ms) */
  timeToFirstToken: number;
  /** 总生成耗时 (ms) */
  totalDuration: number;
  /** 生成速度 (tokens/sec) */
  tokensPerSecond: number;
}
