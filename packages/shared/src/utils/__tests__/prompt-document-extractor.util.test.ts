import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { inflateRaw, readZipEntries, writeZipStore } from '../zip-inflate.util'
import {
  extractDocxText,
  extractPptxText,
  extractPromptDocumentText,
  extractRtfText,
  extractXlsxText,
  extractIpynbText,
  extractOdfText
} from '../prompt-document-extractor.util'

const encoder = new TextEncoder()

function writeZipDeflate(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const compressed = new Uint8Array(deflateRawSync(entry.data))
    const local = new Uint8Array(30 + name.length + compressed.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x800, true)
    localView.setUint16(8, 8, true) // DEFLATE
    localView.setUint32(18, compressed.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(compressed, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x800, true)
    centralView.setUint16(10, 8, true) // DEFLATE
    centralView.setUint32(20, compressed.length, true)
    centralView.setUint32(24, entry.data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)

    offset += local.length
  }

  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(8, entries.length, true)
  eocdView.setUint16(10, entries.length, true)
  eocdView.setUint32(12, centralSize, true)
  eocdView.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + eocd.length)
  let cursor = 0
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

describe('zip-inflate.util', () => {
  it('should decompress deflate-raw buffers with fixed and dynamic Huffman blocks', () => {
    const sample =
      'Hello World! 中文测试段落。'.repeat(120) +
      Array.from({ length: 200 }, (_, i) => `line-${i}`).join('\n')
    const raw = encoder.encode(sample)
    const compressed = new Uint8Array(deflateRawSync(raw))
    const inflated = inflateRaw(compressed)
    expect(new TextDecoder().decode(inflated)).toBe(sample)
  })

  it('should throw when inflated output exceeds maxOutputBytes limit', () => {
    const raw = encoder.encode('A'.repeat(4096))
    const compressed = new Uint8Array(deflateRawSync(raw))
    expect(() => inflateRaw(compressed, 512)).toThrow(/exceeds limit/i)
  })

  it('should read both stored and deflate-compressed zip entries', () => {
    const zip = writeZipDeflate([{ name: 'hello.txt', data: encoder.encode('你好，世界！') }])
    const entries = readZipEntries(zip)
    expect(new TextDecoder().decode(entries.get('hello.txt'))).toBe('你好，世界！')
  })
})

describe('prompt-document-extractor.util', () => {
  it('should extract headings, paragraphs, lists, and tables from .docx buffer', () => {
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>项目周报</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>第一段正文，包含</w:t></w:r>
      <w:r><w:t>拼接文本。</w:t></w:r>
      <w:del><w:r><w:delText>已删除的旧文字</w:delText></w:r></w:del>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>已完成接口联调</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>模块</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>进度</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>伙伴附件</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    const zip = writeZipDeflate([{ name: 'word/document.xml', data: encoder.encode(docXml) }])
    const text = extractDocxText(zip)
    expect(text).toContain('# 项目周报')
    expect(text).toContain('第一段正文，包含拼接文本。')
    expect(text).not.toContain('已删除的旧文字')
    expect(text).toContain('- 已完成接口联调')
    expect(text).toContain('| 模块 | 进度 |')
    expect(text).toContain('| 伙伴附件 | 100% |')
  })

  it('should extract worksheets and shared strings from .xlsx buffer', () => {
    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="营收表" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>季度</t></si>
  <si><t>收入</t></si>
  <si><t>Q1</t></si>
</sst>`
    const sheet1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2"><v>12800</v></c>
    </row>
  </sheetData>
</worksheet>`
    const zip = writeZipStore([
      { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
      { name: 'xl/sharedStrings.xml', data: encoder.encode(sharedStringsXml) },
      { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheet1Xml) }
    ])
    const text = extractXlsxText(zip)
    expect(text).toContain('### 营收表')
    expect(text).toContain('| 季度 | 收入 |')
    expect(text).toContain('| Q1 | 12800 |')
  })

  it('should extract slide text and notes from .pptx buffer', () => {
    const slide1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>第一页标题</a:t></a:r></a:p>
          <a:p><a:r><a:t>核心要点说明</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    const zip = writeZipStore([{ name: 'ppt/slides/slide1.xml', data: encoder.encode(slide1Xml) }])
    const text = extractPptxText(zip)
    expect(text).toContain('### Slide 1')
    expect(text).toContain('第一页标题')
    expect(text).toContain('核心要点说明')
  })

  it('should extract text from OpenDocument (.odt) buffer', () => {
    const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">开放文档标题</text:h>
      <text:p>开放文档段落内容。</text:p>
    </office:text>
  </office:body>
</office:document-content>`
    const zip = writeZipStore([{ name: 'content.xml', data: encoder.encode(contentXml) }])
    const text = extractOdfText(zip)
    expect(text).toContain('# 开放文档标题')
    expect(text).toContain('开放文档段落内容。')
  })

  it('should extract plain text from .rtf buffer', () => {
    const rtf =
      '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\pard Hello \\b World\\b0 !\\par Second \\u20013?\\u25991? line.}'
    const text = extractRtfText(encoder.encode(rtf))
    expect(text).toContain('Hello World!')
    expect(text).toContain('Second 中文 line.')
  })

  it('should extract markdown and code cells from .ipynb while stripping binary image outputs', () => {
    const nb = {
      metadata: { kernelspec: { language: 'python' } },
      cells: [
        { cell_type: 'markdown', source: ['# 数据分析\n', '读取样本数据'] },
        {
          cell_type: 'code',
          source: ['import pandas as pd\n', 'print(42)'],
          outputs: [
            { output_type: 'stream', text: ['42\n'] },
            {
              output_type: 'display_data',
              data: {
                'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
                'text/plain': ['<Figure size 640x480>']
              }
            }
          ]
        }
      ]
    }
    const text = extractIpynbText(encoder.encode(JSON.stringify(nb)))
    expect(text).toContain('# 数据分析')
    expect(text).toContain('```python\nimport pandas as pd\nprint(42)\n```')
    expect(text).toContain('42')
    expect(text).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ')
  })

  it('should dispatch by extension in extractPromptDocumentText', () => {
    const docXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>通用入口测试</w:t></w:r></w:p></w:body></w:document>`
    const zip = writeZipStore([{ name: 'word/document.xml', data: encoder.encode(docXml) }])
    expect(extractPromptDocumentText('report.docx', zip)).toBe('通用入口测试')
  })
})
