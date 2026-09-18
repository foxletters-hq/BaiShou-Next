export function clampAgentGateRepeatThreshold(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(20, Math.floor(n)))
}
