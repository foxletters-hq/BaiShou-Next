import { afterEach, describe, expect, it } from 'vitest'
import { consumeWorkspaceInitMeta, stashWorkspaceInitMeta } from '../workspace-init-meta.util'

describe('workspace-init-meta', () => {
  afterEach(() => {
    consumeWorkspaceInitMeta('s1')
    consumeWorkspaceInitMeta('s2')
    consumeWorkspaceInitMeta('s3')
  })

  it('keeps attachments in the in-memory stash', () => {
    const attachments = [{ fileName: 'brief.pdf', filePath: 'D:/docs/brief.pdf', isPdf: true }]
    stashWorkspaceInitMeta('s1', {
      text: '请阅读这份文件',
      attachments
    })

    expect(consumeWorkspaceInitMeta('s1')).toEqual({
      text: '请阅读这份文件',
      attachments
    })
    expect(consumeWorkspaceInitMeta('s1')).toBeNull()
  })

  it('writes attachment paths to sessionStorage without inline binary', () => {
    stashWorkspaceInitMeta('s3', {
      text: '请阅读',
      attachments: [{ fileName: 'brief.pdf', filePath: 'D:/docs/brief.pdf', isPdf: true, data: 'AAA' }]
    })
    const raw = sessionStorage.getItem('baishou:ws-init-meta:s3')
    expect(raw).toBeTruthy()
    expect(JSON.parse(String(raw))).toEqual({
      text: '请阅读',
      attachments: [{ fileName: 'brief.pdf', filePath: 'D:/docs/brief.pdf', isPdf: true }]
    })
  })

  it('restores attachments from sessionStorage when memory is empty', () => {
    sessionStorage.setItem(
      'baishou:ws-init-meta:s3',
      JSON.stringify({
        text: '请阅读',
        attachments: [{ fileName: 'brief.pdf', filePath: 'D:/docs/brief.pdf', isPdf: true }]
      })
    )
    expect(consumeWorkspaceInitMeta('s3')).toEqual({
      text: '请阅读',
      attachments: [{ fileName: 'brief.pdf', filePath: 'D:/docs/brief.pdf', isPdf: true }]
    })
  })

  it('allows attachment-only stash with empty text', () => {
    const attachments = [{ fileName: 'only.pdf', isPdf: true }]
    stashWorkspaceInitMeta('s2', {
      text: '',
      attachments
    })

    const got = consumeWorkspaceInitMeta('s2')
    expect(got?.text).toBe('')
    expect(got?.attachments).toEqual(attachments)
  })
})
