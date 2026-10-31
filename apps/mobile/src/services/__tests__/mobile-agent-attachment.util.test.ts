import { describe, expect, it, vi } from 'vitest'
import { writeZipStore } from '@baishou/shared'
import { processAgentAttachments } from '../mobile-agent-attachment.util'

vi.mock('../mobile-uri-import', () => ({
  importUriToPath: vi.fn().mockResolvedValue(undefined)
}))

const encoder = new TextEncoder()

function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

describe('processAgentAttachments', () => {
  it('should read textContent for .py files on mobile', async () => {
    const pathService = {
      getAttachmentsBaseDirectory: vi.fn().mockResolvedValue('/vault/Attachments')
    } as any
    const fileSystem = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ size: 64 }),
      readFile: vi.fn().mockResolvedValue('def hello():\n    return 42\n')
    } as any

    const result = await processAgentAttachments(
      pathService,
      fileSystem,
      'sess_1',
      [
        {
          fileName: 'script.py',
          filePath: 'content://com.android.providers.downloads.documents/document/1001'
        }
      ],
      'deepseek-chat',
      'deepseek'
    )

    expect(result).toHaveLength(1)
    expect(result?.[0]?.isText).toBe(true)
    expect(result?.[0]?.textContent).toContain('def hello():')
    expect(result?.[0]?.filePath).toMatch(/\/vault\/Attachments\/sess_1\/script_\d+\.py$/)
  })

  it('should extract Markdown textContent for .docx files on mobile', async () => {
    const docXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>移动端 Word 附件测试</w:t></w:r></w:p></w:body></w:document>`
    const zip = writeZipStore([{ name: 'word/document.xml', data: encoder.encode(docXml) }])
    const b64 = uint8ToBase64(zip)

    const pathService = {
      getAttachmentsBaseDirectory: vi.fn().mockResolvedValue('/vault/Attachments')
    } as any
    const fileSystem = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ size: zip.byteLength }),
      readFile: vi.fn().mockResolvedValue(b64)
    } as any

    const result = await processAgentAttachments(
      pathService,
      fileSystem,
      'sess_1',
      [
        {
          fileName: 'report.docx',
          filePath: 'file:///cache/report.docx'
        }
      ],
      'deepseek-chat',
      'deepseek'
    )

    expect(result).toHaveLength(1)
    expect(result?.[0]?.isText).toBe(true)
    expect(result?.[0]?.textContent).toBe('移动端 Word 附件测试')
  })
})
