import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const mobileHookSrc = readFileSync(join(here, '../useStreamError.ts'), 'utf8')

describe('useStreamError (mobile) chrome', () => {
  it('checks isProviderContentFilterError before image/vision checks and uses gentle copy', () => {
    const filterIdx = mobileHookSrc.indexOf('isProviderContentFilterError')
    const visionIdx = mobileHookSrc.indexOf('VISION_NOT_SUPPORTED')
    expect(filterIdx).toBeGreaterThan(-1)
    expect(visionIdx).toBeGreaterThan(filterIdx)
    expect(mobileHookSrc).toContain('agent.error.content_filter')
    expect(mobileHookSrc).toContain('伙伴被服务商安全机制拦截了呀~不是白守的错哦')
  })
})
