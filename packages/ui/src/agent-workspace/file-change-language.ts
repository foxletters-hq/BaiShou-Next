import type { Extension } from '@codemirror/state'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'

export function languageExtensionForPath(filePath: string): Extension | null {
  const name = filePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: true })
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return javascript({ jsx: true, typescript: true })
    case 'json':
    case 'jsonc':
      return javascript()
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'html':
    case 'htm':
    case 'xhtml':
      return html()
    case 'md':
    case 'mdx':
    case 'markdown':
      return markdown()
    default:
      return null
  }
}
