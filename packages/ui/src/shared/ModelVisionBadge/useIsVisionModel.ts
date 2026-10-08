import { useEffect, useState } from 'react'
import { isVisionModel, subscribeVisionModelsRuntime } from '@baishou/shared'

export function useIsVisionModel(modelId: string, providerKey?: string): boolean {
  const [, setRevision] = useState(0)

  useEffect(() => subscribeVisionModelsRuntime(() => setRevision((n) => n + 1)), [])

  return isVisionModel(modelId, providerKey)
}
