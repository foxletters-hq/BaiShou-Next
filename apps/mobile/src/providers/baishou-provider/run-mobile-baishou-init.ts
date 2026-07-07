import type { MobileBaishouInitContext } from './init-context'
import { bootstrapMobileBaishouCore } from './bootstrap-mobile-baishou-core'

export async function runMobileBaishouInit(ctx: MobileBaishouInitContext): Promise<void> {
  await bootstrapMobileBaishouCore(ctx)
}
