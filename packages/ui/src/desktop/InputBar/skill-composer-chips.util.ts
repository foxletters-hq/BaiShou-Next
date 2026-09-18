import { formatFileMentionLabel, type PromptFileSelection } from '@baishou/shared'
import {
  FILE_REF_CHIP_ATTR,
  FILE_REF_COMMENT_ATTR,
  FILE_REF_DIRECTORY_ATTR,
  FILE_REF_ORIGIN_ATTR,
  FILE_REF_PATH_ATTR,
  FILE_REF_SELECTION_ATTR,
  SKILL_CHIP_ATTR,
  SKILL_COMMAND_ATTR,
  SKILL_CONTENT_ATTR,
  type FileRefChip,
  type SkillRefChip
} from './skill-composer.types'

export function makeSkillChipId(command: string): string {
  return `${command}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function makeFileRefChipId(relativePath: string): string {
  return `file-${relativePath.replace(/[^\w.-]+/g, '_')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createSkillChipElement(
  chip: SkillRefChip,
  chipClassName: string,
  textClassName: string
): HTMLSpanElement {
  const el = document.createElement('span')
  el.setAttribute(SKILL_CHIP_ATTR, chip.id)
  el.setAttribute(SKILL_COMMAND_ATTR, chip.command)
  el.setAttribute(SKILL_CONTENT_ATTR, chip.content)
  el.contentEditable = 'false'
  el.className = chipClassName
  el.setAttribute('data-skill-chip', 'true')

  const label = document.createElement('span')
  label.className = textClassName
  label.textContent = `/${chip.command}`
  el.appendChild(label)
  return el
}

export function isSkillChip(node: Node | null): boolean {
  return (
    !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute(SKILL_CHIP_ATTR)
  )
}

export function isFileRefChip(node: Node | null): boolean {
  return (
    !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute(FILE_REF_CHIP_ATTR)
  )
}

export function isComposerChip(node: Node | null): boolean {
  return isSkillChip(node) || isFileRefChip(node)
}

export function readFileRefChip(chipEl: HTMLElement): FileRefChip {
  const id = chipEl.getAttribute(FILE_REF_CHIP_ATTR) || makeFileRefChipId('file')
  const relativePath = chipEl.getAttribute(FILE_REF_PATH_ATTR) || ''
  const rawSelection = chipEl.getAttribute(FILE_REF_SELECTION_ATTR)
  let selection: PromptFileSelection | undefined
  if (rawSelection) {
    try {
      const parsed = JSON.parse(rawSelection) as PromptFileSelection
      if (
        Number.isFinite(parsed.startLine) &&
        Number.isFinite(parsed.endLine) &&
        parsed.startLine >= 1 &&
        parsed.endLine >= 1
      ) {
        selection = {
          startLine: Math.min(parsed.startLine, parsed.endLine),
          endLine: Math.max(parsed.startLine, parsed.endLine)
        }
      }
    } catch {
      selection = undefined
    }
  }
  const comment = chipEl.getAttribute(FILE_REF_COMMENT_ATTR) || undefined
  const origin = (chipEl.getAttribute(FILE_REF_ORIGIN_ATTR) || 'mention') as FileRefChip['origin']
  const isDirectory = chipEl.getAttribute(FILE_REF_DIRECTORY_ATTR) === 'true'
  return {
    id,
    relativePath,
    selection,
    comment,
    origin,
    ...(isDirectory ? { isDirectory: true } : {})
  }
}

export function createFileRefChipElement(
  chip: FileRefChip,
  chipClassName: string,
  textClassName: string
): HTMLSpanElement {
  const el = document.createElement('span')
  el.setAttribute(FILE_REF_CHIP_ATTR, chip.id)
  el.setAttribute(FILE_REF_PATH_ATTR, chip.relativePath)
  if (chip.selection) el.setAttribute(FILE_REF_SELECTION_ATTR, JSON.stringify(chip.selection))
  if (chip.comment) el.setAttribute(FILE_REF_COMMENT_ATTR, chip.comment)
  if (chip.origin) el.setAttribute(FILE_REF_ORIGIN_ATTR, chip.origin)
  if (chip.isDirectory) el.setAttribute(FILE_REF_DIRECTORY_ATTR, 'true')
  el.contentEditable = 'false'
  el.className = chipClassName
  el.setAttribute('data-file-chip', 'true')
  el.title = chip.comment?.trim()
    ? `${chip.relativePath}\n${chip.comment.trim()}`
    : chip.relativePath

  const label = document.createElement('span')
  label.className = textClassName
  label.textContent = formatFileMentionLabel(chip)
  el.appendChild(label)
  return el
}
