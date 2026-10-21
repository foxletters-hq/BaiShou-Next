import { z } from 'zod'
import {
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError,
  companionAskCancelledMessage,
  normalizeCompanionAskQuestions,
  readQuestionAnswer,
  type AgentGateToolMetadata
} from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import {
  CompanionAskStreamSession,
  parseCompanionAskStreamArgs,
  registerCompanionAskStreamSession
} from './companion-ask-stream.util'

const companionAskQuestionParams = z.object({
  question: z.string().describe('One question to ask the user.'),
  options: z
    .array(z.string())
    .optional()
    .describe(
      'Choices for this question. When multiple is true, each option must be a single item (do not add "both/all" or "only X" options).'
    ),
  allow_custom_input: z
    .boolean()
    .optional()
    .describe('Whether the user may type a custom answer for this question.'),
  multiple: z
    .boolean()
    .optional()
    .describe(
      'Set to true when the user can select more than one option (multi-select). Defaults to false (single choice).'
    )
})

const companionAskParams = z.object({
  question: z
    .string()
    .optional()
    .describe('Single question. Use questions instead when asking more than one thing.'),
  options: z
    .array(z.string())
    .optional()
    .describe(
      'Choices for the single question. When multiple is true, each option must be a single item (do not add "both/all" or "only X" options).'
    ),
  allow_custom_input: z
    .boolean()
    .optional()
    .describe('Whether the user may type a custom answer instead of picking an option.'),
  multiple: z
    .boolean()
    .optional()
    .describe(
      'Set to true when the user can select more than one option (multi-select). Defaults to false (single choice).'
    ),
  questions: z
    .array(companionAskQuestionParams)
    .optional()
    .describe(
      'Ask several independent questions in one call. The user answers them one at a time on the same card. Related choices that share one decision stay in a single question with options (set multiple: true when multiple options can be selected together).'
    )
})

function declinedPayload(questions: ReturnType<typeof normalizeCompanionAskQuestions>) {
  const first = questions[0]
  return {
    approved: false,
    declined: true,
    question: first?.question,
    answers: questions.map((item) => ({
      question: item.question,
      answer: null,
      selectedOptionIds: [] as string[]
    }))
  }
}

export class CompanionAskTool extends AgentTool<typeof companionAskParams> {
  readonly name = 'companion_ask'

  readonly description =
    'Ask the user one or more required questions and wait for the answers before executing an action or branching decision. ' +
    'You MUST call this tool for action confirmation, yes/no task decisions, or naming choices (do not use for casual conversational chat or empathy follow-ups). ' +
    'Set multiple: true when the user may select more than one option, and list each item as its own option without "both/all" or "only X" phrasing. ' +
    'Independent questions that can be decided together MUST go in questions on this same call. ' +
    'Do not ask one thing, wait, then ask a follow-up that could have been on the first card. ' +
    'Never write those action/decision questions as plain chat text.'

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

  /**
   * 参数流收齐就开门。基类 execute 仍负责真正等待用户；
   * 模型侧稍后的 execute 复用同一次等待。
   */
  override toVercelTool(context: ToolContext): any {
    const vercelTool = super.toVercelTool(context)
    const baseExecute = vercelTool.execute.bind(vercelTool) as (
      args: z.infer<typeof companionAskParams>,
      options?: { toolCallId?: string }
    ) => Promise<string>
    const stream = new CompanionAskStreamSession((args) => baseExecute(args))
    registerCompanionAskStreamSession(context.sessionId, stream)

    vercelTool.onInputDelta = ({
      inputTextDelta,
      toolCallId
    }: {
      inputTextDelta: string
      toolCallId: string
    }) => {
      stream.pushDelta(toolCallId, inputTextDelta)
    }
    vercelTool.onInputAvailable = ({
      input,
      toolCallId
    }: {
      input: unknown
      toolCallId: string
    }) => {
      const parsed = parseCompanionAskStreamArgs(
        typeof input === 'string' ? input : JSON.stringify(input ?? {})
      )
      if (parsed) stream.claim(toolCallId, parsed)
    }
    vercelTool.execute = (
      args: z.infer<typeof companionAskParams>,
      options?: { toolCallId?: string }
    ) => {
      const toolCallId = options?.toolCallId
      if (!toolCallId) {
        const existing = stream.peekInflight()
        if (existing) return existing
        return baseExecute(args, options)
      }
      return stream.claim(toolCallId, args)
    }
    return vercelTool
  }

  async execute(args: z.infer<typeof companionAskParams>, context: ToolContext): Promise<string> {
    const questions = normalizeCompanionAskQuestions({
      question: args.question,
      options: args.options,
      allowCustomInput: args.allow_custom_input,
      multiple: args.multiple,
      questions: args.questions?.map((item) => ({
        question: item.question,
        options: item.options,
        allowCustomInput: item.allow_custom_input,
        multiple: item.multiple
      }))
    })
    const first = questions[0]
    if (!first) {
      return JSON.stringify({ approved: false, declined: true, error: 'missing question' })
    }

    const gate = context.agentGate
    if (!gate) {
      return JSON.stringify({
        approved: true,
        question: first.question,
        answers: questions.map((item) => ({
          question: item.question,
          answer: null,
          selectedOptionIds: []
        }))
      })
    }

    try {
      const resolution = await gate.assertWithResolution({
        sessionId: context.sessionId,
        vaultName: context.vaultName,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: first.question,
        options: first.options,
        allowCustomInput: questions.some((item) => item.allowCustomInput),
        ...(first.multiple ? { multiple: true } : {}),
        questions
      })

      const answers = questions.map((item) => ({
        question: item.question,
        ...readQuestionAnswer(item, resolution, questions.length === 1)
      }))

      return JSON.stringify({
        approved: true,
        question: first.question,
        answer: answers[0]?.answer ?? null,
        selectedOptionIds: answers[0]?.selectedOptionIds ?? [],
        answers
      })
    } catch (error) {
      if (error instanceof AgentGateCancelledError) {
        return JSON.stringify(declinedPayload(questions))
      }
      if (error instanceof AgentGateCorrectedError) {
        return error.feedback
      }
      if (error instanceof AgentGateRejectedError) {
        const locale =
          typeof context.userConfig?.locale === 'string' ? context.userConfig.locale : undefined
        return companionAskCancelledMessage(locale)
      }
      throw error
    }
  }
}
