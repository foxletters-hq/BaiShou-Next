import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { splitSkillMarkdownMeta } from '@baishou/shared'
import { hideSyntaxEmptyReplace } from './styles'
import { pushLineDecoration, pushReplaceDecoration, type DecorationMark } from './decorationMarks'

const PROPERTY_KEY_RE = /^([A-Za-z][\w-]*)\s*:/
const YAML_FENCE_RE = /^\s*---\s*$/

const propertiesLine = Decoration.line({ class: 'cm-wb-properties' })
const propertiesLineFirst = Decoration.line({
  class: 'cm-wb-properties cm-wb-properties-first'
})
const propertiesLineLast = Decoration.line({
  class: 'cm-wb-properties cm-wb-properties-last'
})
const propertiesLineOnly = Decoration.line({
  class: 'cm-wb-properties cm-wb-properties-first cm-wb-properties-last'
})
const propertyKeyMark = Decoration.mark({ class: 'cm-wb-property-key' })

function lineStyleFor(index: number, total: number): Decoration {
  if (total === 1) return propertiesLineOnly
  if (index === 0) return propertiesLineFirst
  if (index === total - 1) return propertiesLineLast
  return propertiesLine
}

/**
 * 将 SKILL.md 顶部 properties（或旧版 --- YAML）标成元信息块，避免 `---` 被画成分割线。
 * 返回这些行号，供其它行语法装饰跳过。
 */
export function collectSkillPropertyDecorations(
  state: EditorState,
  activeLines: Set<number>,
  marks: DecorationMark[]
): Set<number> {
  const skipped = new Set<number>()
  const meta = splitSkillMarkdownMeta(state.doc.toString())
  if (!meta || meta.headerEnd <= 0) return skipped

  const doc = state.doc
  const lineNumbers: number[] = []
  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    const line = doc.line(lineNum)
    if (line.from >= meta.headerEnd) break
    lineNumbers.push(lineNum)
    skipped.add(lineNum)
  }
  if (lineNumbers.length === 0) return skipped

  lineNumbers.forEach((lineNum, index) => {
    const line = doc.line(lineNum)
    pushLineDecoration(marks, lineStyleFor(index, lineNumbers.length), line.from)
    const isActive = activeLines.has(lineNum)
    if (YAML_FENCE_RE.test(line.text)) {
      if (!isActive && line.from < line.to) {
        pushReplaceDecoration(marks, doc, line.from, line.to, hideSyntaxEmptyReplace)
      }
      return
    }
    if (isActive) return
    const keyMatch = line.text.match(PROPERTY_KEY_RE)
    if (!keyMatch) return
    const keyTo = line.from + keyMatch[1]!.length
    marks.push(propertyKeyMark.range(line.from, keyTo))
  })

  return skipped
}
