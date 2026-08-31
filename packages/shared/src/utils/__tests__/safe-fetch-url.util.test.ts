import { describe, expect, it } from 'vitest'
import { assertSafeHttpUrl, assertSafePublicHttpUrl } from '../safe-fetch-url.util'

describe('assertSafeHttpUrl', () => {
  it('允许内网与本机 http(s)', () => {
    expect(() => assertSafeHttpUrl('http://192.168.1.8/wiki')).not.toThrow()
    expect(() => assertSafeHttpUrl('http://10.0.0.2/docs')).not.toThrow()
    expect(() => assertSafeHttpUrl('http://localhost:8080/page')).not.toThrow()
    expect(() => assertSafeHttpUrl('https://nas.local/share')).not.toThrow()
  })

  it('拒绝非 http(s)', () => {
    expect(() => assertSafeHttpUrl('file:///tmp/a')).toThrow(/http\/https/i)
    expect(() => assertSafeHttpUrl('javascript:alert(1)')).toThrow(/http\/https/i)
  })
})

describe('assertSafePublicHttpUrl', () => {
  it('拦截私网', () => {
    expect(() => assertSafePublicHttpUrl('http://127.0.0.1/secret')).toThrow(/private|local/i)
    expect(() => assertSafePublicHttpUrl('http://192.168.1.1/')).toThrow(/private|local/i)
  })

  it('允许公网', () => {
    expect(() => assertSafePublicHttpUrl('https://example.com/page')).not.toThrow()
  })
})
