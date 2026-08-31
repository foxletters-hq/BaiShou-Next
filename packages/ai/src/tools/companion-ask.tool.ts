import { z } from 'zod'
import {
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError,
  type AgentGateToolMetadata
} from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const companionAskParams = z.object({
  question: z.string().describe('The question to ask the user.'),
  options: z
    .array(z.string())
    .optional()
    .describe('Optional numbered choices for the user to pick from.'),
  allow_custom_input: z
    .boolean()
    .optional()
    .describe('Whether the user may type a custom answer instead of picking an option.')
})

export class CompanionAskTool extends AgentTool<typeof companionAskParams> {
  readonly name = 'companion_ask'

  readonly description =
    'Ask the user a required multiple-choice question and wait for the answer. ' +
    'You MUST call this tool for confirmation, yes/no, or naming choices. ' +
    'Never write those questions as plain chat text.'

  readonly parameters = companionAskParams

  get category(): string {
    return 'companion'
  }

  get icon(): string {
    return 'message-circle-question'
  }

  get canBeDisabled(): boolean {
    return true
  }

  get showInSettings(): boolean {
    return true
  }

  override get agentGateMetadata(): AgentGateToolMetadata | undefined {
    return undefined
  }

  async execute(args: z.infer<typeof companionAskParams>, context: ToolContext): Promise<string> {
    const gate = context.agentGate
    if (!gate) {
      return JSON.stringify({ approved: true, question: args.question })
    }

    const options =
      args.options?.map((label, index) => ({
        id: String(index),
        label
      })) ?? []

    try {
      const resolution = await gate.assertWithResolution({
        sessionId: context.sessionId,
        vaultName: context.vaultName,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: args.question,
        options,
        allowCustomInput: args.allow_custom_input ?? true
      })

      const selectedId = resolution.selectedOptionIds?.[0]
      const selectedLabel =
        selectedId != null ? options.find((option) => option.id === selectedId)?.label : undefined

      return JSON.stringify({
        approved: true,
        question: args.question,
        answer: selectedLabel ?? resolution.message ?? null,
        selectedOptionIds: resolution.selectedOptionIds ?? []
      })
    } catch (error) {
      if (error instanceof AgentGateCorrectedError) {
        return error.feedback
      }
      if (error instanceof AgentGateRejectedError) {
        return 'User declined to answer.'
      }
      throw error
    }
  }
}
