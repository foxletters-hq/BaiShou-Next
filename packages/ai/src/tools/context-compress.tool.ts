import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const upstreamParams = z.object({
  force: z
    .boolean()
    .optional()
    .describe('If true, run compression even when estimated tokens are below the threshold.')
})

const downstreamParams = z.object({
  force: z
    .boolean()
    .optional()
    .describe('If true, run compression even when estimated tokens are below the threshold.')
})

type CompressToolParams = z.infer<typeof upstreamParams>

abstract class ContextCompressToolBase extends AgentTool<typeof upstreamParams> {
  abstract readonly phase: 'upstream' | 'downstream'

  get category(): string {
    return 'memory'
  }

  get icon(): string {
    return 'minimize'
  }

  async execute(args: CompressToolParams, context: ToolContext): Promise<string> {
    const runner = context.contextCompressionRunner
    if (!runner) {
      return 'Context compression runner is not available in this session.'
    }
    return runner.run(this.phase, { force: args.force === true })
  }
}

/** 上行压缩：在将上下文发送给模型之前合并早期对话为摘要 */
export class ContextCompressUpstreamTool extends ContextCompressToolBase {
  readonly name = 'compress_context_upstream'
  readonly phase = 'upstream' as const
  readonly description =
    'Compress early conversation history into a rolling summary before the next model request (upstream / input-side). ' +
    'Use when context is very long or the user asks to condense memory. Normally the app also auto-compresses when over the token threshold.'
  readonly parameters = upstreamParams
}

/** 下行压缩：在助手回复落盘之后更新摘要并剪枝过长工具输出 */
export class ContextCompressDownstreamTool extends ContextCompressToolBase {
  readonly name = 'compress_context_downstream'
  readonly phase = 'downstream' as const
  readonly description =
    'Compress conversation history after the assistant reply is saved (downstream / post-turn). ' +
    'Use to refresh the long-term summary when the dialogue has grown large. Normally runs automatically after each turn when over threshold.'
  readonly parameters = downstreamParams
}
