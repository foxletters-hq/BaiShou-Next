import { readZipEntries } from './zip-entries.util'

const TEXT_EXT = /\.(xhtml|html|htm)$/i

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() || ''
}

function resolveZipPath(baseDir: string, href: string): string {
  const raw = href.split('#')[0].replace(/\\/g, '/').replace(/^\.\//, '')
  const joined = baseDir ? `${baseDir}/${raw}` : raw
  const parts: string[] = []
  for (const part of joined.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function xhtmlToMarkdown(html: string): string {
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
  result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${stripTags(content)}\n`)
  result = stripTags(result)
  return decodeEntities(result)
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

function findOpfPath(entries: Map<string, Uint8Array>): string {
  const container = entries.get('META-INF/container.xml')
  if (!container) throw new Error('epub: missing META-INF/container.xml')
  const xml = new TextDecoder('utf-8').decode(container)
  const rootfile = xml.match(/<rootfile\b[^>]*>/i)?.[0] || ''
  const fullPath = attr(rootfile, 'full-path')
  if (!fullPath) throw new Error('epub: missing package document path')
  return fullPath.replace(/\\/g, '/')
}

function listSpineHrefs(opfXml: string, opfDir: string): string[] {
  const manifest = new Map<string, string>()
  const itemRe = /<item\b[^>]*>/gi
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemRe.exec(opfXml))) {
    const tag = itemMatch[0]
    const id = attr(tag, 'id')
    const href = attr(tag, 'href')
    if (id && href) manifest.set(id, href)
  }
  const hrefs: string[] = []
  const refRe = /<itemref\b[^>]*>/gi
  let refMatch: RegExpExecArray | null
  while ((refMatch = refRe.exec(opfXml))) {
    const idref = attr(refMatch[0], 'idref')
    const href = idref ? manifest.get(idref) : ''
    if (!href || !TEXT_EXT.test(href)) continue
    hrefs.push(resolveZipPath(opfDir, href))
  }
  return hrefs
}

export function extractEpubPageTexts(buffer: Uint8Array): string[] {
  const entries = readZipEntries(buffer)
  const opfPath = findOpfPath(entries)
  const opfBuf = entries.get(opfPath)
  if (!opfBuf) throw new Error(`epub: missing package document ${opfPath}`)
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const hrefs = listSpineHrefs(new TextDecoder('utf-8').decode(opfBuf), opfDir)
  if (hrefs.length === 0) {
    throw new Error('epub: spine has no HTML documents')
  }
  return hrefs.map((href) => {
    const bytes = entries.get(href)
    if (!bytes) return ''
    return xhtmlToMarkdown(new TextDecoder('utf-8').decode(bytes))
  })
}
