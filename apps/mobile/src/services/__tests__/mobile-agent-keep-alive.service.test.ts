import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from 'react-native'
import * as serverModule from 'expo-baishou-server'
import {
  acquireAgentStreamKeepAlive,
  releaseAgentStreamKeepAlive,
  checkAgentStreamKeepAliveActive
} from '../mobile-agent-keep-alive.service'

vi.mock('expo-baishou-server', () => ({
  startAgentKeepAlive: vi.fn(),
  stopAgentKeepAlive: vi.fn(),
  isAgentKeepAliveActive: vi.fn()
}))

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android'
  }
}))

vi.mock('@baishou/shared', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

describe('mobile-agent-keep-alive.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Platform.OS = 'android'
  })

  it('calls startAgentKeepAlive on Android with default text', () => {
    vi.mocked(serverModule.startAgentKeepAlive).mockReturnValue(true)

    acquireAgentStreamKeepAlive('session-1')

    expect(serverModule.startAgentKeepAlive).toHaveBeenCalledWith(
      'session-1',
      expect.stringContaining('生成回复'),
      expect.stringContaining('后台运行')
    )
  })

  it('calls startAgentKeepAlive with custom title and content', () => {
    vi.mocked(serverModule.startAgentKeepAlive).mockReturnValue(true)

    acquireAgentStreamKeepAlive('session-2', {
      title: '自定义标题',
      content: '自定义内容'
    })

    expect(serverModule.startAgentKeepAlive).toHaveBeenCalledWith(
      'session-2',
      '自定义标题',
      '自定义内容'
    )
  })

  it('does nothing when Platform is not android', () => {
    Platform.OS = 'ios'

    acquireAgentStreamKeepAlive('session-ios')
    releaseAgentStreamKeepAlive('session-ios')
    const active = checkAgentStreamKeepAliveActive()

    expect(serverModule.startAgentKeepAlive).not.toHaveBeenCalled()
    expect(serverModule.stopAgentKeepAlive).not.toHaveBeenCalled()
    expect(active).toBe(false)
  })

  it('calls stopAgentKeepAlive on Android', () => {
    vi.mocked(serverModule.stopAgentKeepAlive).mockReturnValue(true)

    releaseAgentStreamKeepAlive('session-1')

    expect(serverModule.stopAgentKeepAlive).toHaveBeenCalledWith('session-1')
  })

  it('handles native call throwing gracefully without bubbling exception', () => {
    vi.mocked(serverModule.startAgentKeepAlive).mockImplementation(() => {
      throw new Error('Native error')
    })

    expect(() => {
      acquireAgentStreamKeepAlive('session-err')
    }).not.toThrow()
  })

  it('checks active state correctly', () => {
    vi.mocked(serverModule.isAgentKeepAliveActive).mockReturnValue(true)

    const active = checkAgentStreamKeepAliveActive()
    expect(active).toBe(true)
    expect(serverModule.isAgentKeepAliveActive).toHaveBeenCalled()
  })
})
