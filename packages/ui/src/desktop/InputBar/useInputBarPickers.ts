import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CREATE_SKILL_SLASH_COMMAND,
  getShortcutCommand,
  parseFileMentionToken,
  type PromptFileRef,
  type PromptShortcut
} from '@baishou/shared'
import type { MentionToken, SlashToken } from './skill-composer.util'

export function useInputBarPickers(params: {
  localizedShortcuts: PromptShortcut[] | undefined
  slashToken: SlashToken | null
  mentionToken: MentionToken | null
  fileMention:
    | { enabled?: boolean; recentPaths?: string[]; searchFiles?: (q: string) => Promise<string[]> }
    | undefined
  insertFileRefChip: (ref: PromptFileRef, token?: MentionToken | null) => void
  armCreateSkillChip: () => void
  applyShortcut: (shortcut: PromptShortcut) => void
}) {
  const {
    localizedShortcuts,
    slashToken,
    mentionToken,
    fileMention,
    insertFileRefChip,
    armCreateSkillChip,
    applyShortcut
  } = params

  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false)
  const [skillPickerIndex, setSkillPickerIndex] = useState(0)
  const [mentionPickerIndex, setMentionPickerIndex] = useState(0)
  const [mentionSearchPaths, setMentionSearchPaths] = useState<string[]>([])

  const closeSkillPicker = useCallback(() => {
    setSkillPickerOpen(false)
  }, [])

  const closeMentionPicker = useCallback(() => {
    setMentionPickerOpen(false)
  }, [])

  const filteredShortcuts = useMemo(() => {
    const list = localizedShortcuts ?? []
    const q = (slashToken?.query || '').trim().toLowerCase()
    if (!q) return list
    return list.filter((shortcut) => {
      const command = getShortcutCommand(shortcut).toLowerCase()
      const name = (shortcut.name || shortcut.tag || '').toLowerCase()
      const description = (shortcut.description || '').toLowerCase()
      return command.includes(q) || name.includes(q) || description.includes(q)
    })
  }, [localizedShortcuts, slashToken])

  const slashPickerEntries = useMemo(() => {
    const q = (slashToken?.query || '').trim().toLowerCase()
    const createName = CREATE_SKILL_SLASH_COMMAND
    const createDesc = CREATE_SKILL_SLASH_COMMAND
    const entries: Array<{
      id: string
      name: string
      description: string
      kind: 'create' | 'skill'
      skill?: PromptShortcut
    }> = []

    const createMatches =
      !q ||
      createName.includes(q) ||
      createDesc.toLowerCase().includes(q) ||
      'create skill'.includes(q)
    if (createMatches) {
      entries.push({
        id: '__create-skill__',
        name: createName,
        description: createDesc,
        kind: 'create'
      })
    }

    for (const skill of filteredShortcuts) {
      const command = getShortcutCommand(skill)
      if (command === CREATE_SKILL_SLASH_COMMAND) continue
      entries.push({
        id: skill.id,
        name: command,
        description: (skill.description || skill.name || '').trim(),
        kind: 'skill',
        skill
      })
    }
    return entries
  }, [filteredShortcuts, slashToken])

  const mentionPathQuery = useMemo(
    () => parseFileMentionToken(mentionToken?.query || '').relativePath,
    [mentionToken?.query]
  )

  useEffect(() => {
    if (!fileMention?.enabled || !mentionPickerOpen) {
      setMentionSearchPaths([])
      return undefined
    }
    const search = fileMention.searchFiles
    if (!search || !mentionPathQuery.trim()) {
      setMentionSearchPaths([])
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void search(mentionPathQuery).then((paths) => {
        if (!cancelled) setMentionSearchPaths(paths)
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fileMention, mentionPathQuery, mentionPickerOpen])

  const mentionPickerEntries = useMemo(() => {
    if (!fileMention?.enabled) return []
    const query = mentionPathQuery.toLowerCase()
    const seen = new Set<string>()
    const entries: Array<{ id: string; path: string; group: 'recent' | 'search' }> = []
    for (const path of fileMention.recentPaths ?? []) {
      const normalized = path.replace(/\\/g, '/')
      if (!normalized || seen.has(normalized)) continue
      if (query && !normalized.toLowerCase().includes(query)) continue
      seen.add(normalized)
      entries.push({ id: `recent:${normalized}`, path: normalized, group: 'recent' })
    }
    for (const path of mentionSearchPaths) {
      const normalized = path.replace(/\\/g, '/')
      if (!normalized || seen.has(normalized)) continue
      if (query && !normalized.toLowerCase().includes(query)) continue
      seen.add(normalized)
      entries.push({ id: `search:${normalized}`, path: normalized, group: 'search' })
    }
    return entries.slice(0, 20)
  }, [fileMention, mentionPathQuery, mentionSearchPaths])

  useEffect(() => {
    setSkillPickerIndex(0)
  }, [slashToken?.query, slashPickerEntries.length])

  useEffect(() => {
    setMentionPickerIndex(0)
  }, [mentionToken?.query, mentionPickerEntries.length])

  useEffect(() => {
    if (skillPickerIndex > 0 && skillPickerIndex >= slashPickerEntries.length) {
      setSkillPickerIndex(Math.max(0, slashPickerEntries.length - 1))
    }
  }, [slashPickerEntries.length, skillPickerIndex])

  const submitMentionPickerSelection = useCallback(() => {
    const picked = mentionPickerEntries[mentionPickerIndex]
    if (!picked) return
    const parsed = parseFileMentionToken(mentionToken?.query || '')
    insertFileRefChip(
      {
        relativePath: picked.path,
        selection: parsed.selection,
        origin: 'mention'
      },
      mentionToken
    )
  }, [insertFileRefChip, mentionPickerEntries, mentionPickerIndex, mentionToken])

  const submitSlashPickerSelection = useCallback(() => {
    const picked = slashPickerEntries[skillPickerIndex]
    if (!picked) return
    if (picked.kind === 'create') {
      armCreateSkillChip()
      return
    }
    if (picked.skill) applyShortcut(picked.skill)
  }, [slashPickerEntries, skillPickerIndex, armCreateSkillChip, applyShortcut])

  return useMemo(
    () => ({
      skillPickerOpen,
      setSkillPickerOpen,
      mentionPickerOpen,
      setMentionPickerOpen,
      skillPickerIndex,
      setSkillPickerIndex,
      mentionPickerIndex,
      setMentionPickerIndex,
      closeSkillPicker,
      closeMentionPicker,
      filteredShortcuts,
      slashPickerEntries,
      mentionPickerEntries,
      submitMentionPickerSelection,
      submitSlashPickerSelection
    }),
    [
      skillPickerOpen,
      mentionPickerOpen,
      skillPickerIndex,
      mentionPickerIndex,
      closeSkillPicker,
      closeMentionPicker,
      filteredShortcuts,
      slashPickerEntries,
      mentionPickerEntries,
      submitMentionPickerSelection,
      submitSlashPickerSelection
    ]
  )
}
