export async function limitExecute<T, R>(
  items: T[],
  concurrencyLimit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++
      const item = items[currentIndex]!
      results[currentIndex] = await fn(item)
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}
