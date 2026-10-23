export type EmojiCldrRecord = {
  emoji: string
  annotation: string
  tags: string[]
  group: number
  order: number
}

export function filterEmojiCldrRecords(data: EmojiCldrRecord[]): EmojiCldrRecord[] {
  return data.filter((item) => Boolean(item.emoji) && item.group !== 2)
}

export async function loadEmojiCldrData(): Promise<EmojiCldrRecord[]> {
  const mod = await import('emoji-picker-element-data/en/cldr/data.json')
  const data = ('default' in mod && mod.default ? mod.default : mod) as EmojiCldrRecord[]
  return filterEmojiCldrRecords(data)
}
