import { z } from 'zod'
import { tool } from 'ai'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

type EmojiItem = { id: string; name: string; relativePath: string }
type EmojiConfig = { enabled?: boolean; emojis?: EmojiItem[] }

const emojiSendParams = z.object({
  emoji_id: z
    .string()
    .describe(
      'The ID or name of the sticker/emoji to send. Can be the sticker ID (e.g. "yawning_good_morning") or the display name (e.g. "yawning good morning"). Fuzzy matching is supported.'
    ),
  reason: z
    .string()
    .optional()
    .describe(
      'A brief reason for choosing this sticker (1-10 words). Helps contextualize the sticker choice.'
    )
})

export class EmojiSendTool extends AgentTool<typeof emojiSendParams> {
  readonly name = 'emoji_send'

  readonly description =
    'Send a sticker/emoji image in the chat. ' +
    'Call this tool with one of the available sticker IDs or names when it naturally fits the conversation mood (humor, empathy, celebration, etc.). ' +
    'The emoji_id parameter is flexible — you can pass the sticker ID (with or without file extension) or the display name. ' +
    'Only one sticker per reply — call emoji_send at most once per turn. ' +
    'Do NOT call this tool on every message — only when a sticker genuinely adds emotional expression. ' +
    'After calling this tool, continue your text response normally. The sticker will be displayed as a separate message automatically — do NOT mention or repeat the sticker result in your text.'

  readonly parameters = emojiSendParams

  get category(): string {
    return 'general'
  }

  get icon(): string {
    return 'Smile'
  }

  get canBeDisabled(): boolean {
    return true
  }

  get showInSettings(): boolean {
    return false
  }

  /**
   * Override toVercelTool: 将可用表情包列表动态注入工具描述，
   * 让模型从工具描述本身获取可用表情包，而非依赖 system prompt 注入。
   */
  override toVercelTool(context: ToolContext): any {
    const emojiConfig =
      (context.userConfig?.['emojiConfig'] as EmojiConfig | undefined) || undefined
    const emojis = emojiConfig?.emojis || []

    const listLines =
      emojis.length > 0
        ? emojis.map((e) => `- ${e.id.replace(/\.[^.]+$/, '')}: ${e.name}`).join('\n')
        : '(none)'

    const dynamicDescription =
      this.description +
      '\n\nAvailable sticker IDs and names:\n' +
      listLines +
      '\n\nTo send a sticker, call this tool with the emoji_id parameter set to one of the IDs above. The emoji_id is flexible — you can pass the ID with or without the file extension, or use the display name. ' +
      'Send at most one sticker per reply.'

    return tool({
      description: dynamicDescription,
      inputSchema: this.parameters,
      execute: async (args: z.infer<typeof emojiSendParams>) => {
        try {
          console.log(
            `[AgentTool] Executing tool "${this.name}" with args:`,
            JSON.stringify(args).slice(0, 200)
          )
          const result = await this.execute(args, context)
          console.log(`[AgentTool] Tool "${this.name}" completed successfully`)
          return result
        } catch (e: any) {
          console.error(`[AgentTool] Tool "${this.name}" threw an unhandled error:`, e)
          return `工具执行失败 (${this.name}): ${e?.message || String(e)}`
        }
      }
    })
  }

  async execute(args: z.infer<typeof emojiSendParams>, context: ToolContext): Promise<string> {
    const { emoji_id, reason } = args

    const emojiConfig =
      (context.userConfig?.['emojiConfig'] as EmojiConfig | undefined) || undefined

    if (!emojiConfig?.emojis || emojiConfig.emojis.length === 0) {
      return 'No stickers are available. The user has not uploaded any stickers yet.'
    }

    const emoji = this.findEmoji(emoji_id, emojiConfig.emojis)
    if (!emoji) {
      const availableIds = emojiConfig.emojis.map((e) => e.id.replace(/\.[^.]+$/, '')).join(', ')
      return `Sticker "${emoji_id}" not found. Available sticker IDs: ${availableIds}`
    }

    // Return a simple success message — the persist layer will create an image attachment
    // based on the tool call arguments (emoji_id → emoji.relativePath)
    const reasonText = reason ? ` (${reason})` : ''
    return `Sticker sent: ${emoji.name}${reasonText}`
  }

  /**
   * Fuzzy match emoji by id or name:
   * 1. Exact id match (e.g. "yawning_good_morning.png")
   * 2. Id without extension match (e.g. "yawning_good_morning" matches "yawning_good_morning.png")
   * 3. Name match (case-insensitive, e.g. "yawning good morning" matches name "yawning_good_morning")
   * 4. Id without extension contains query (e.g. "yawning" matches "yawning_good_morning.png")
   * 5. Name contains query (e.g. "good morning" matches name "yawning good morning")
   */
  private findEmoji(
    query: string,
    emojis: Array<{ id: string; name: string; relativePath: string }>
  ): { id: string; name: string; relativePath: string } | undefined {
    const normalizedQuery = query.trim().toLowerCase()

    // 1. Exact id match
    const exactMatch = emojis.find(
      (e) => e.id === normalizedQuery || e.id.toLowerCase() === normalizedQuery
    )
    if (exactMatch) return exactMatch

    // 2. Id without extension match
    const idNoExtMatch = emojis.find(
      (e) => e.id.replace(/\.[^.]+$/, '').toLowerCase() === normalizedQuery
    )
    if (idNoExtMatch) return idNoExtMatch

    // 3. Name match (case-insensitive, underscore/space normalized)
    const normalizeName = (s: string) =>
      s
        .toLowerCase()
        .replace(/[_\s]+/g, ' ')
        .trim()
    const normalizedNameQuery = normalizeName(normalizedQuery)
    const nameMatch = emojis.find((e) => normalizeName(e.name) === normalizedNameQuery)
    if (nameMatch) return nameMatch

    // 4. Id without extension contains query
    const idContainsMatch = emojis.find((e) =>
      e.id
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .includes(normalizedQuery)
    )
    if (idContainsMatch) return idContainsMatch

    // 5. Name contains query
    const nameContainsMatch = emojis.find((e) =>
      normalizeName(e.name).includes(normalizedNameQuery)
    )
    if (nameContainsMatch) return nameContainsMatch

    return undefined
  }
}
