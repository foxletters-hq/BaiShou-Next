import type { PromptFileRef } from '@baishou/shared'

export type SkillRefChip = {
  id: string
  command: string
  content: string
}

export type FileRefChip = PromptFileRef & {
  id: string
}

export const SKILL_CHIP_ATTR = 'data-skill-ref'
export const SKILL_COMMAND_ATTR = 'data-skill-command'
export const SKILL_CONTENT_ATTR = 'data-skill-content'
export const FILE_REF_CHIP_ATTR = 'data-file-ref'
export const FILE_REF_PATH_ATTR = 'data-file-path'
export const FILE_REF_SELECTION_ATTR = 'data-file-selection'
export const FILE_REF_COMMENT_ATTR = 'data-file-comment'
export const FILE_REF_ORIGIN_ATTR = 'data-file-origin'
export const FILE_REF_DIRECTORY_ATTR = 'data-file-directory'

export type SlashToken = {
  query: string
  range: Range
}

export type MentionToken = SlashToken
