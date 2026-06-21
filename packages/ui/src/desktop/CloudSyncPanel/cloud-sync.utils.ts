export async function ensureMinLoadingDelay(startTime: number, minMs = 300): Promise<void> {
  const remaining = minMs - (Date.now() - startTime)
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}
