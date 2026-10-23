export function formatRecallInjection(
  items: Array<{ date: string; title: string; snippet: string }>
): string {
  if (items.length === 0) return ''
  return items
    .map(
      (item) => `<memory date="${item.date}" source="${item.title}">\n${item.snippet}\n</memory>`
    )
    .join('\n\n')
}
