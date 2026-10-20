import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CREATE_SKILL_SLASH_COMMAND,
  getCreateSkillGuidePrompt,
  getDefaultShortcutLabelsFromT,
  localizeAgentSkill,
  localizeAgentSkills,
  type AgentSkill,
  type AgentSkillWriteInput
} from '@baishou/shared'
import {
  ensureOfficialCreateSkill,
  matchesWorkbenchSkillSearch,
  omitHiddenBundledTemplateSkills,
  partitionWorkbenchSkills,
  resolveScopedWorkbenchSkills
} from '../../utils/workspace-skill-launch.util'
import { GLOBAL_SKILL_SCOPE } from './WorkbenchSkillsSkillTab'

type SkillsListApi = {
  list?: () => Promise<AgentSkill[]>
  listWorkspace?: (folderRoot: string) => Promise<AgentSkill[]>
  update?: (input: AgentSkillWriteInput) => Promise<AgentSkill>
  updateWorkspace?: (folderRoot: string, input: AgentSkillWriteInput) => Promise<AgentSkill>
}

export function getSkillsApi(): SkillsListApi | undefined {
  return (window.api as { skills?: SkillsListApi }).skills
}

export function useWorkbenchSkillsCatalog(params: {
  tab: 'skill' | 'template' | 'mcp'
  query: string
  scopeId: string
  folderRoot: string
  waitingForProject: boolean
}) {
  const { t } = useTranslation()
  const [listedSkills, setListedSkills] = useState<AgentSkill[]>([])
  const [projectSkills, setProjectSkills] = useState<AgentSkill[]>([])
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [loadingProjectSkills, setLoadingProjectSkills] = useState(false)

  useEffect(() => {
    if (params.tab !== 'skill') return
    let cancelled = false
    setLoadingSkills(true)
    const load = async (): Promise<AgentSkill[]> => {
      return (await getSkillsApi()?.list?.()) ?? []
    }
    void load()
      .then((skills) => {
        if (cancelled) return
        setListedSkills(skills)
      })
      .catch(() => {
        if (!cancelled) setListedSkills([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSkills(false)
      })
    const unsubSkills = (
      window.api as { skills?: { onChanged?: (cb: () => void) => () => void } }
    ).skills?.onChanged?.(() => {
      if (cancelled) return
      void load()
        .then((skills) => {
          if (!cancelled) setListedSkills(skills)
        })
        .catch(() => {
          if (!cancelled) setListedSkills([])
        })
    })
    return () => {
      cancelled = true
      unsubSkills?.()
    }
  }, [params.tab])

  useEffect(() => {
    if (params.tab !== 'skill') return
    if (params.waitingForProject) {
      setLoadingProjectSkills(true)
      setProjectSkills([])
      return
    }
    if (params.scopeId === GLOBAL_SKILL_SCOPE) {
      setProjectSkills([])
      setLoadingProjectSkills(false)
      return
    }
    let cancelled = false
    setLoadingProjectSkills(true)
    setProjectSkills([])
    const folderRoot = params.folderRoot
    const load = async (): Promise<AgentSkill[]> => {
      if (!folderRoot) return []
      return (await getSkillsApi()?.listWorkspace?.(folderRoot)) ?? []
    }
    void load()
      .then((skills) => {
        if (cancelled) return
        setProjectSkills(skills)
      })
      .catch(() => {
        if (!cancelled) setProjectSkills([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProjectSkills(false)
      })
    const unsubSkills = (
      window.api as { skills?: { onChanged?: (cb: () => void) => () => void } }
    ).skills?.onChanged?.(() => {
      if (cancelled) return
      void load()
        .then((skills) => {
          if (!cancelled) setProjectSkills(skills)
        })
        .catch(() => {
          if (!cancelled) setProjectSkills([])
        })
    })
    return () => {
      cancelled = true
      unsubSkills?.()
    }
  }, [params.folderRoot, params.scopeId, params.tab, params.waitingForProject])

  const shortcutLabels = useMemo(() => getDefaultShortcutLabelsFromT(t), [t])

  const skillMatchesQuery = useCallback(
    (skill: AgentSkill): boolean => {
      const localized = localizeAgentSkill(skill, shortcutLabels)
      return matchesWorkbenchSkillSearch(params.query, {
        name: skill.name,
        title: localized.description || skill.name,
        description:
          `${localized.description || ''} ${skill.description || ''}`.trim() || skill.name
      })
    },
    [params.query, shortcutLabels]
  )

  const visibleOfficialAndUser = useMemo(
    () =>
      localizeAgentSkills(omitHiddenBundledTemplateSkills(listedSkills), shortcutLabels).filter(
        skillMatchesQuery
      ),
    [listedSkills, shortcutLabels, skillMatchesQuery]
  )
  const { official: officialSkills, user: userSkills } = useMemo(
    () => partitionWorkbenchSkills(visibleOfficialAndUser),
    [visibleOfficialAndUser]
  )
  const visibleProjectSkills = useMemo(
    () => projectSkills.filter(skillMatchesQuery),
    [projectSkills, skillMatchesQuery]
  )
  const scopedSkills = useMemo(
    () =>
      resolveScopedWorkbenchSkills({
        scope: params.scopeId === GLOBAL_SKILL_SCOPE ? 'global' : 'project',
        userSkills,
        projectSkills: visibleProjectSkills
      }),
    [params.scopeId, userSkills, visibleProjectSkills]
  )

  const officialIconSkills = useMemo(
    () =>
      ensureOfficialCreateSkill(officialSkills, {
        name: CREATE_SKILL_SLASH_COMMAND,
        description: shortcutLabels.createSkillDescription || CREATE_SKILL_SLASH_COMMAND,
        content: getCreateSkillGuidePrompt(t),
        location: '',
        source: 'software'
      }).filter(skillMatchesQuery),
    [officialSkills, shortcutLabels, skillMatchesQuery, t]
  )

  return {
    loadingSkills,
    loadingProjectSkills,
    officialIconSkills,
    scopedSkills
  }
}
