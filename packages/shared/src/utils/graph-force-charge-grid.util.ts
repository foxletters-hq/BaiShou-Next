export function graphForceGridCellKey(x: number, y: number, cell: number): string {
  const size = cell > 0 ? cell : 1
  return `${Math.floor(x / size)}:${Math.floor(y / size)}`
}

export function pushGraphForceGridIndex(
  grid: Map<string, number[]>,
  index: number,
  x: number,
  y: number,
  cell: number
): void {
  const key = graphForceGridCellKey(x, y, cell)
  const bucket = grid.get(key)
  if (bucket) bucket.push(index)
  else grid.set(key, [index])
}

/** Same cell and the eight neighbors — enough for a capped pairwise charge. */
export function forEachGraphForceGridNeighbor(
  grid: Map<string, number[]>,
  x: number,
  y: number,
  cell: number,
  visit: (index: number) => void
): void {
  const size = cell > 0 ? cell : 1
  const cx = Math.floor(x / size)
  const cy = Math.floor(y / size)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(`${cx + dx}:${cy + dy}`)
      if (!bucket) continue
      for (const index of bucket) visit(index)
    }
  }
}

export function collectGraphForceGridNeighbors(
  grid: Map<string, number[]>,
  x: number,
  y: number,
  cell: number
): number[] {
  const out: number[] = []
  forEachGraphForceGridNeighbor(grid, x, y, cell, (index) => {
    out.push(index)
  })
  return out
}
