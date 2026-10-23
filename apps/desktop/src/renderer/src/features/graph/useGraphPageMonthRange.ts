import { useState } from 'react'
import {
  clampGraphMonthRange,
  defaultGraphMonthRange,
  loadGraphMonthRange,
  saveGraphMonthRange,
  type GraphMonthRange
} from '@baishou/shared'

export function useGraphPageMonthRange() {
  const [monthRange, setMonthRange] = useState<GraphMonthRange>(() => loadGraphMonthRange())

  const persistMonthRange = (next: GraphMonthRange) => {
    saveGraphMonthRange(next)
    setMonthRange(next)
  }

  const mergeMonthRange = (next: GraphMonthRange | Partial<GraphMonthRange>) => {
    const merged = clampGraphMonthRange({ ...monthRange, ...next })
    persistMonthRange(merged)
    return merged
  }

  const resetMonthRangeValue = () => {
    const next = defaultGraphMonthRange()
    persistMonthRange(next)
    return next
  }

  return {
    monthRange,
    mergeMonthRange,
    resetMonthRangeValue
  }
}
