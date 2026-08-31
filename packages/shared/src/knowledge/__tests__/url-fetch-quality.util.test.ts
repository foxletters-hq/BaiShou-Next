import { describe, expect, it } from 'vitest'
import { assessFetchedWebPage } from '../url-fetch-quality.util'

describe('assessFetchedWebPage', () => {
  it('rejects login redirects', () => {
    const result = assessFetchedWebPage({
      requestedUrl: 'https://www.opcquan.com/projects/demo',
      finalUrl: 'https://www.opcquan.com/login?callbackUrl=%2Fprojects%2Fdemo',
      markdown: '# 登录\n\n[发布需求](/plaza/new)\n加载中...'
    })
    expect(result).toEqual({ usable: false, issue: 'login' })
  })

  it('rejects a javascript shell with only nav and loading text', () => {
    const result = assessFetchedWebPage({
      requestedUrl: 'https://example.com/app',
      finalUrl: 'https://example.com/app',
      markdown: '[发布需求](/plaza/new)\n[发布产品](/settings#products)\n\n加载中...\n开始连接\n加入社群'
    })
    expect(result.usable).toBe(false)
    expect(result.issue).toBe('empty-shell')
  })

  it('keeps an article with real paragraphs', () => {
    const result = assessFetchedWebPage({
      requestedUrl: 'https://example.com/post',
      finalUrl: 'https://example.com/post',
      markdown:
        '# 视听语言\n\n蒙太奇通过镜头组接创造新的意义。场面调度决定人物在空间中的位置，声音则补足画面没有直接给出的信息。'
    })
    expect(result).toEqual({ usable: true, issue: null })
  })
})
