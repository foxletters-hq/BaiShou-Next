import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveAgentDbPath } from '../db'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/baishou-user-data'
  }
}))

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

describe('resolveAgentDbPath', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('places agent db under workspace root when custom root is provided', () => {
    expect(normalizePath(resolveAgentDbPath('/home/user/Documents/BaiShou_Root'))).toBe(
      '/home/user/Documents/BaiShou_Root/baishou_agent.db'
    )
  })

  it('falls back to electron userData when workspace root is empty', () => {
    expect(normalizePath(resolveAgentDbPath())).toBe('/tmp/baishou-user-data/baishou_agent.db')
  })
})
