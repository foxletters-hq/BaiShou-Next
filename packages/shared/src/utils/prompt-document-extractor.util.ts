import { extensionOfFileName } from './prompt-attachment-kind.util'
import { readZipEntries } from './zip-inflate.util'

const utf8Decoder = new TextDecoder('utf-8')

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
}

function getXmlAttr(tag: string, attrName: string): string {
  const match = tag.match(new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function formatMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return ''
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (colCount === 0) return ''

  const normalizeCell = (cell: string): string =>
    cell.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()

  const normalizedRows = rows.map((row) =>
    Array.from({ length: colCount }, (_, idx) => normalizeCell(row[idx] ?? ''))
  )
  // 跳过全空行
  const nonEmptyRows = normalizedRows.filter((row) => row.some((c) => c.length > 0))
  if (nonEmptyRows.length === 0) return ''

  const header = nonEmptyRows[0]!
  const separator = Array.from({ length: colCount }, () => '---')
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...nonEmptyRows.slice(1).map((row) => `| ${row.join(' | ')} |`)
  ]
  return lines.join('\n')
}

function isOle2Container(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  )
}

function extractWordParagraphText(pXml: string): string {
  // 移除修订删除内容，避免已删除文字混入正文
  const withoutDeletions = pXml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/gi, '')
  const tokenRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:br|cr)\b[^>]*\/?>|<w:tab\b[^>]*\/?>/gi
  let out = ''
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(withoutDeletions))) {
    const full = match[0]
    if (match[1] !== undefined) {
      out += decodeXmlEntities(match[1])
    } else if (/^<w:tab/i.test(full)) {
      out += '\t'
    } else {
      out += '\n'
    }
  }
  return out.trim()
}

function formatWordParagraph(pXml: string): string {
  const text = extractWordParagraphText(pXml)
  if (!text) return ''

  const styleMatch = pXml.match(/<w:pStyle\b[^>]*w:val\s*=\s*["']([^"']+)["']/i)
  const styleVal = styleMatch?.[1] ?? ''
  const headingMatch =
    styleVal.match(/^(?:Heading|标题\s*)([1-6])$/i) || styleVal.match(/^([1-6])$/)
  if (headingMatch) {
    const level = Math.min(6, Math.max(1, Number(headingMatch[1])))
    return `${'#'.repeat(level)} ${text}`
  }

  if (/<w:numPr\b/i.test(pXml)) {
    const ilvlMatch = pXml.match(/<w:ilvl\b[^>]*w:val\s*=\s*["'](\d+)["']/i)
    const indent = '  '.repeat(Math.min(4, Number(ilvlMatch?.[1] ?? 0)))
    return `${indent}- ${text}`
  }

  return text
}

function formatWordTable(tblXml: string): string {
  const rows: string[][] = []
  const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(tblXml))) {
    const rowXml = trMatch[1] ?? ''
    const row: string[] = []
    const tcRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi
    let tcMatch: RegExpExecArray | null
    while ((tcMatch = tcRe.exec(rowXml))) {
      const cellXml = tcMatch[1] ?? ''
      const cellParagraphs: string[] = []
      const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi
      let pMatch: RegExpExecArray | null
      while ((pMatch = pRe.exec(cellXml))) {
        const pText = extractWordParagraphText(pMatch[0])
        if (pText) cellParagraphs.push(pText)
      }
      row.push(cellParagraphs.join(' / '))
    }
    if (row.length > 0) rows.push(row)
  }
  return formatMarkdownTable(rows)
}

/**
 * 提取 Word (.docx) 文本与表格为 Markdown。
 */
export function extractDocxText(buffer: Uint8Array): string {
  if (isOle2Container(buffer)) {
    throw new Error('docx: encrypted or legacy OLE2 container')
  }
  const entries = readZipEntries(buffer, {
    filter: (name) =>
      name === 'word/document.xml' || name === 'word/footnotes.xml' || name === 'word/endnotes.xml'
  })
  const docBytes = entries.get('word/document.xml')
  if (!docBytes) {
    throw new Error('docx: missing word/document.xml')
  }

  const xml = utf8Decoder.decode(docBytes)
  const blocks: string[] = []
  const blockRe = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/gi
  let match: RegExpExecArray | null
  while ((match = blockRe.exec(xml))) {
    const block = match[0]
    if (/^<w:tbl\b/i.test(block)) {
      const tableMd = formatWordTable(block)
      if (tableMd) blocks.push(tableMd)
    } else {
      const paraMd = formatWordParagraph(block)
      if (paraMd) blocks.push(paraMd)
    }
  }

  for (const extraName of ['word/footnotes.xml', 'word/endnotes.xml']) {
    const extraBytes = entries.get(extraName)
    if (!extraBytes) continue
    const extraXml = utf8Decoder.decode(extraBytes)
    const pRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/gi
    let pMatch: RegExpExecArray | null
    while ((pMatch = pRe.exec(extraXml))) {
      const text = extractWordParagraphText(pMatch[0])
      if (text) blocks.push(text)
    }
  }

  return blocks.join('\n\n').trim()
}

function excelColIndex(cellRef: string): number {
  const letters = cellRef.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
  if (!letters) return -1
  let col = 0
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64)
  }
  return col - 1
}

function parseSharedStrings(xml: string): string[] {
  const result: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let siMatch: RegExpExecArray | null
  while ((siMatch = siRe.exec(xml))) {
    const siContent = (siMatch[1] ?? '').replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/gi, '')
    const parts: string[] = []
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi
    let tMatch: RegExpExecArray | null
    while ((tMatch = tRe.exec(siContent))) {
      parts.push(decodeXmlEntities(tMatch[1] ?? ''))
    }
    result.push(parts.join(''))
  }
  return result
}

function parseWorksheetTable(sheetXml: string, sharedStrings: string[]): string {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const rowContent = rowMatch[1] ?? ''
    const rowCells: string[] = []
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi
    let cellMatch: RegExpExecArray | null
    let nextCol = 0
    while ((cellMatch = cellRe.exec(rowContent))) {
      const attrs = cellMatch[1] ?? ''
      const inner = cellMatch[2] ?? ''
      const ref = getXmlAttr(attrs, 'r')
      const colIdx = ref ? excelColIndex(ref) : -1
      const targetCol = colIdx >= 0 ? colIdx : nextCol
      nextCol = targetCol + 1

      const cellType = getXmlAttr(attrs, 't')
      let value = ''
      if (cellType === 'inlineStr') {
        const tParts: string[] = []
        const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi
        let tMatch: RegExpExecArray | null
        while ((tMatch = tRe.exec(inner))) {
          tParts.push(decodeXmlEntities(tMatch[1] ?? ''))
        }
        value = tParts.join('')
      } else {
        const rawVal = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/i)?.[1] ?? ''
        if (cellType === 's') {
          const idx = Number(rawVal)
          value = Number.isFinite(idx) ? (sharedStrings[idx] ?? '') : ''
        } else if (cellType === 'b') {
          value = rawVal === '1' ? 'TRUE' : rawVal === '0' ? 'FALSE' : rawVal
        } else {
          value = decodeXmlEntities(rawVal)
        }
      }
      rowCells[targetCol] = value
    }
    if (rowCells.some((c) => c && c.trim().length > 0)) {
      rows.push(Array.from({ length: rowCells.length }, (_, i) => rowCells[i] ?? ''))
    }
  }
  return formatMarkdownTable(rows)
}

/**
 * 提取 Excel (.xlsx) 各工作表为 Markdown 表格。
 */
export function extractXlsxText(buffer: Uint8Array): string {
  if (isOle2Container(buffer)) {
    throw new Error('xlsx: encrypted or legacy OLE2 container')
  }
  const entries = readZipEntries(buffer, {
    filter: (name) =>
      name === 'xl/workbook.xml' ||
      name === 'xl/_rels/workbook.xml.rels' ||
      name === 'xl/sharedStrings.xml' ||
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
  })

  const sharedStringsBytes = entries.get('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsBytes
    ? parseSharedStrings(utf8Decoder.decode(sharedStringsBytes))
    : []

  const sheetNames: string[] = []
  const workbookBytes = entries.get('xl/workbook.xml')
  if (workbookBytes) {
    const wbXml = utf8Decoder.decode(workbookBytes)
    const sheetRe = /<sheet\b[^>]*>/gi
    let sheetMatch: RegExpExecArray | null
    while ((sheetMatch = sheetRe.exec(wbXml))) {
      const name = decodeXmlEntities(getXmlAttr(sheetMatch[0], 'name'))
      if (name) sheetNames.push(name)
    }
  }

  const sheetEntries = [...entries.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)\.xml$/i)?.[1] ?? 0)
      const nb = Number(b.match(/sheet(\d+)\.xml$/i)?.[1] ?? 0)
      return na - nb
    })

  if (sheetEntries.length === 0) {
    throw new Error('xlsx: no worksheet entries found')
  }

  const sections: string[] = []
  sheetEntries.forEach((entryKey, idx) => {
    const sheetBytes = entries.get(entryKey)
    if (!sheetBytes) return
    const tableMd = parseWorksheetTable(utf8Decoder.decode(sheetBytes), sharedStrings)
    if (!tableMd) return
    const title = sheetNames[idx] || `Sheet ${idx + 1}`
    sections.push(`### ${title}\n\n${tableMd}`)
  })

  return sections.join('\n\n').trim()
}

/**
 * 提取 PowerPoint (.pptx) 各幻灯片正文与备注为 Markdown。
 */
export function extractPptxText(buffer: Uint8Array): string {
  if (isOle2Container(buffer)) {
    throw new Error('pptx: encrypted or legacy OLE2 container')
  }
  const entries = readZipEntries(buffer, {
    filter: (name) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(name) ||
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name)
  })

  const slideKeys = [...entries.keys()]
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
      const nb = Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
      return na - nb
    })

  if (slideKeys.length === 0) {
    throw new Error('pptx: no slides found')
  }

  const extractDrawingParagraphs = (xml: string): string[] => {
    const lines: string[] = []
    const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi
    let pMatch: RegExpExecArray | null
    while ((pMatch = pRe.exec(xml))) {
      const pContent = pMatch[1] ?? ''
      const tRe = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/?>/gi
      let tMatch: RegExpExecArray | null
      let para = ''
      while ((tMatch = tRe.exec(pContent))) {
        if (tMatch[1] !== undefined) {
          para += decodeXmlEntities(tMatch[1])
        } else {
          para += '\n'
        }
      }
      if (para.trim()) lines.push(para.trim())
    }
    return lines
  }

  const sections: string[] = []
  for (const key of slideKeys) {
    const num = Number(key.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
    const slideBytes = entries.get(key)
    if (!slideBytes) continue
    const paragraphs = extractDrawingParagraphs(utf8Decoder.decode(slideBytes))
    const notesBytes = entries.get(`ppt/notesSlides/notesSlide${num}.xml`)
    const notes = notesBytes ? extractDrawingParagraphs(utf8Decoder.decode(notesBytes)) : []
    if (paragraphs.length === 0 && notes.length === 0) continue

    let block = `### Slide ${num}\n\n${paragraphs.join('\n')}`
    if (notes.length > 0) {
      block += `\n\n> Notes: ${notes.join(' ')}`
    }
    sections.push(block.trim())
  }

  return sections.join('\n\n').trim()
}

/**
 * 提取 OpenDocument (.odt / .ods / .odp) 的 content.xml 为 Markdown。
 */
export function extractOdfText(buffer: Uint8Array): string {
  const entries = readZipEntries(buffer, {
    filter: (name) => name === 'content.xml'
  })
  const contentBytes = entries.get('content.xml')
  if (!contentBytes) {
    throw new Error('odf: missing content.xml')
  }
  const xml = utf8Decoder.decode(contentBytes)
  const stripOdfInline = (fragment: string): string =>
    decodeXmlEntities(
      fragment
        .replace(/<text:tab\b[^>]*\/?>/gi, '\t')
        .replace(/<text:line-break\b[^>]*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    ).trim()

  const blocks: string[] = []
  const blockRe =
    /<table:table\b[^>]*>[\s\S]*?<\/table:table>|<text:h\b([^>]*)>([\s\S]*?)<\/text:h>|<text:p\b[^>]*>([\s\S]*?)<\/text:p>/gi
  let match: RegExpExecArray | null
  while ((match = blockRe.exec(xml))) {
    const full = match[0]
    if (/^<table:table\b/i.test(full)) {
      const rows: string[][] = []
      const rowRe = /<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/gi
      let rMatch: RegExpExecArray | null
      while ((rMatch = rowRe.exec(full))) {
        const row: string[] = []
        const cellRe = /<table:table-cell\b[^>]*>([\s\S]*?)<\/table:table-cell>/gi
        let cMatch: RegExpExecArray | null
        while ((cMatch = cellRe.exec(rMatch[1] ?? ''))) {
          row.push(stripOdfInline(cMatch[1] ?? ''))
        }
        if (row.length > 0) rows.push(row)
      }
      const tableMd = formatMarkdownTable(rows)
      if (tableMd) blocks.push(tableMd)
    } else if (match[2] !== undefined) {
      const levelAttr = getXmlAttr(match[1] ?? '', 'text:outline-level')
      const level = Math.min(6, Math.max(1, Number(levelAttr || 1)))
      const text = stripOdfInline(match[2])
      if (text) blocks.push(`${'#'.repeat(level)} ${text}`)
    } else if (match[3] !== undefined) {
      const text = stripOdfInline(match[3])
      if (text) blocks.push(text)
    }
  }
  return blocks.join('\n\n').trim()
}

function resolveZipRelativePath(baseDir: string, href: string): string {
  const raw = (href.split('#')[0] ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  const joined = baseDir ? `${baseDir}/${raw}` : raw
  const parts: string[] = []
  for (const part of joined.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function xhtmlToMarkdown(html: string): string {
  const stripTags = (s: string): string => s.replace(/<[^>]+>/g, '')
  let result = html.replace(
    /<(script|style|nav|footer|header|noscript|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi,
    ''
  )
  result = result.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  for (let i = 6; i >= 1; i -= 1) {
    const regex = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi')
    result = result.replace(regex, (_, content) => `\n${'#'.repeat(i)} ${stripTags(content)}\n`)
  }
  result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `\n${stripTags(content)}\n`)
  result = result.replace(/<br\s*\/?>/gi, '\n')
  result = result.replace(/<div[^>]*>/gi, '\n')
  result = result.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_, __, content) => `**${content}**`
  )
  result = result.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, content) => `*${content}*`)
  result = result.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_, content) => `- ${stripTags(content)}\n`
  )
  result = stripTags(result)
  return decodeXmlEntities(result)
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

/**
 * 提取 EPUB (.epub) 章节文本为 Markdown。
 */
export function extractEpubText(buffer: Uint8Array): string {
  const entries = readZipEntries(buffer)
  const container = entries.get('META-INF/container.xml')
  if (!container) throw new Error('epub: missing META-INF/container.xml')
  const containerXml = utf8Decoder.decode(container)
  const rootfileTag = containerXml.match(/<rootfile\b[^>]*>/i)?.[0] || ''
  const opfPath = getXmlAttr(rootfileTag, 'full-path').replace(/\\/g, '/')
  if (!opfPath) throw new Error('epub: missing package document path')
  const opfBuf = entries.get(opfPath)
  if (!opfBuf) throw new Error(`epub: missing package document ${opfPath}`)
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const opfXml = utf8Decoder.decode(opfBuf)

  const manifest = new Map<string, string>()
  const itemRe = /<item\b[^>]*>/gi
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemRe.exec(opfXml))) {
    const id = getXmlAttr(itemMatch[0], 'id')
    const href = getXmlAttr(itemMatch[0], 'href')
    if (id && href) manifest.set(id, href)
  }

  const pages: string[] = []
  const refRe = /<itemref\b[^>]*>/gi
  let refMatch: RegExpExecArray | null
  while ((refMatch = refRe.exec(opfXml))) {
    const idref = getXmlAttr(refMatch[0], 'idref')
    const href = idref ? manifest.get(idref) : ''
    if (!href || !/\.(xhtml|html|htm)$/i.test(href)) continue
    const target = resolveZipRelativePath(opfDir, href)
    const bytes = entries.get(target)
    if (!bytes) continue
    const md = xhtmlToMarkdown(utf8Decoder.decode(bytes))
    if (md) pages.push(md)
  }
  return pages.join('\n\n').trim()
}

/**
 * 提取 Rich Text Format (.rtf) 为纯文本。
 */
export function extractRtfText(buffer: Uint8Array): string {
  const raw = utf8Decoder.decode(buffer)
  if (!raw.trimStart().startsWith('{\\rtf')) {
    return raw.trim()
  }

  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'fldinst',
    'header',
    'footer'
  ])

  let out = ''
  let i = 0
  let depth = 0
  let skipDepth = -1
  let ucSkip = 1

  while (i < raw.length) {
    const ch = raw[i]!
    if (ch === '{') {
      depth++
      i++
      if (raw.slice(i, i + 2) === '\\*') {
        if (skipDepth < 0) skipDepth = depth
        i += 2
        continue
      }
      const destMatch = raw.slice(i).match(/^\\([a-zA-Z]+)/)
      if (destMatch && skipDestinations.has(destMatch[1]!.toLowerCase())) {
        if (skipDepth < 0) skipDepth = depth
      }
      continue
    }
    if (ch === '}') {
      if (depth === skipDepth) {
        skipDepth = -1
      }
      depth = Math.max(0, depth - 1)
      i++
      continue
    }
    if (skipDepth >= 0 && depth >= skipDepth) {
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }
    if (ch === '\\') {
      i++
      if (i >= raw.length) break
      const next = raw[i]!
      if (next === '\\' || next === '{' || next === '}') {
        out += next
        i++
        continue
      }
      if (next === '~') {
        out += ' '
        i++
        continue
      }
      if (next === "'") {
        const hex = raw.slice(i + 1, i + 3)
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16))
          i += 3
          continue
        }
      }
      const ctrlMatch = raw.slice(i).match(/^([a-zA-Z]+)(-?\d+)?(?:\s)?/)
      if (ctrlMatch) {
        const word = ctrlMatch[1]!.toLowerCase()
        const param = ctrlMatch[2]
        i += ctrlMatch[0].length
        if (word === 'par' || word === 'line' || word === 'row' || word === 'sect') {
          out += '\n'
        } else if (word === 'tab' || word === 'cell') {
          out += '\t'
        } else if (word === 'uc' && param !== undefined) {
          ucSkip = Math.max(0, Number(param))
        } else if (word === 'u' && param !== undefined) {
          let code = Number(param)
          if (code < 0) code += 65536
          out += String.fromCodePoint(code)
          // 跳过紧随 \uN 的 ANSI 替代字符
          for (let s = 0; s < ucSkip && i < raw.length; s++) {
            if (raw.slice(i, i + 2) === "\\'") {
              i += 4
            } else if (raw[i] !== '{' && raw[i] !== '}') {
              i++
            }
          }
        }
        continue
      }
      i++
      continue
    }
    out += ch
    i++
  }

  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function joinNotebookLines(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : '')).join('')
  }
  return ''
}

/**
 * 提取 Jupyter Notebook (.ipynb) 的 Markdown 单元格、代码单元格与文本输出，剔除大体积二进制图像输出。
 */
export function extractIpynbText(buffer: Uint8Array): string {
  const raw = utf8Decoder.decode(buffer)
  let parsed: {
    metadata?: {
      kernelspec?: { language?: string }
      language_info?: { name?: string }
    }
    cells?: Array<{
      cell_type?: string
      source?: unknown
      outputs?: Array<{
        output_type?: string
        text?: unknown
        ename?: string
        evalue?: string
        data?: Record<string, unknown>
      }>
    }>
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw.trim()
  }

  if (!Array.isArray(parsed?.cells)) {
    return raw.trim()
  }

  const lang =
    parsed.metadata?.kernelspec?.language || parsed.metadata?.language_info?.name || 'python'
  const blocks: string[] = []

  for (const cell of parsed.cells) {
    const source = joinNotebookLines(cell?.source).trim()
    if (!source && (!cell?.outputs || cell.outputs.length === 0)) continue

    if (cell.cell_type === 'code') {
      const parts: string[] = []
      if (source) {
        parts.push(`\`\`\`${lang}\n${source}\n\`\`\``)
      }
      if (Array.isArray(cell.outputs)) {
        const outTexts: string[] = []
        for (const out of cell.outputs) {
          if (out.output_type === 'stream') {
            const streamText = joinNotebookLines(out.text).trim()
            if (streamText) outTexts.push(streamText)
          } else if (out.output_type === 'error') {
            const errLine = [out.ename, out.evalue].filter(Boolean).join(': ')
            if (errLine) outTexts.push(errLine)
          } else if (out.data && typeof out.data === 'object') {
            const plain = joinNotebookLines(out.data['text/plain']).trim()
            if (plain) outTexts.push(plain)
          }
        }
        if (outTexts.length > 0) {
          parts.push(`Output:\n\`\`\`text\n${outTexts.join('\n')}\n\`\`\``)
        }
      }
      if (parts.length > 0) blocks.push(parts.join('\n\n'))
    } else {
      if (source) blocks.push(source)
    }
  }

  return blocks.join('\n\n').trim()
}

/**
 * 统一附件文档转换入口：按扩展名将复合文档（.docx/.xlsx/.pptx/.odt/.ods/.odp/.epub/.rtf/.ipynb）转换为 Markdown/文本。
 */
export function extractPromptDocumentText(
  fileName: string,
  buffer: Uint8Array,
  _mimeType?: string
): string {
  const ext = extensionOfFileName(fileName)
  switch (ext) {
    case '.docx':
      return extractDocxText(buffer)
    case '.xlsx':
      return extractXlsxText(buffer)
    case '.pptx':
      return extractPptxText(buffer)
    case '.odt':
    case '.ods':
    case '.odp':
      return extractOdfText(buffer)
    case '.epub':
      return extractEpubText(buffer)
    case '.rtf':
      return extractRtfText(buffer)
    case '.ipynb':
      return extractIpynbText(buffer)
    default:
      throw new Error(`Unsupported convertible document extension: ${ext || fileName}`)
  }
}
