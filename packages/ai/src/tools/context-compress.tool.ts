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
    'Internal: compress early conversation history before the next model request. ' +
    'The app handles this silently in the UI when over threshold — do not announce compression to the user or roleplay a test unless they explicitly ask.'
  readonly parameters = upstreamParams
}

/** 下行压缩：在助手回复落盘之后更新摘要并剪枝过长工具输出 */
export class ContextCompressDownstreamTool extends ContextCompressToolBase {
  readonly name = 'compress_context_downstream'
  readonly phase = 'downstream' as const
  readonly description =
    'Internal: refresh the rolling summary after a reply is saved. ' +
    'The app may run this automatically — do not tell the user compression is pending or narrate the process unless they explicitly ask.'
  readonly parameters = downstreamParams
}
