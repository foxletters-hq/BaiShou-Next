import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Globe, Pencil, Search, Sparkles } from 'lucide-react'
import {
  CREATE_SKILL_SLASH_COMMAND,
  WRITER_SKILL_CONTENT,
  WRITER_SKILL_NAME,
  getCreateSkillGuidePrompt,
  type AgentSkill,
  type AgentSkillWriteInput,
  type AgentWorkspaceEntry
} from '@baishou/shared'
import { Input, SegmentedControl, Select, useDialog, useToast } from '@baishou/ui'
import { useSettingsPaneApi, useSettingsStore } from '@baishou/store'
import { McpSettingsPane } from '../../../settings/components/McpSettingsPane'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from '../../hooks/useAgentWorkspaceChrome'
import { useWorkspaceSessions } from '../../hooks/useWorkspaceSessions'
import { sortAgentWorkspaces } from '../../utils/workspace-display.util'
import { stashWorkspaceInitMeta } from '../../utils/workspace-init-meta.util'
import {
  buildSkillSendMeta,
  ensureOfficialCreateSkill,
  matchesWorkbenchSkillSearch,
  omitHiddenBundledTemplateSkills,
  partitionWorkbenchSkills,
  resolveScopedWorkbenchSkills,
  resolveSkillEditScope,
  resolveWorkbenchSkillsPageTab
} from '../../utils/workspace-skill-launch.util'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchSkillEditorDialog } from './WorkbenchSkillEditorDialog'
import { WorkbenchSkillLaunchDialog } from './WorkbenchSkillLaunchDialog'
import { WorkbenchHomeSidebar } from '../home/WorkbenchHomeSidebar'
import pageStyles from '../home/WorkbenchHomePage.module.css'
import { WORKBENCH_SKILL_CARDS } from './workbench-skill-catalog'
import styles from './WorkbenchSkillsPage.module.css'

const GLOBAL_SKILL_SCOPE = 'global'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

type SkillsListApi = {
  list?: () => Promise<AgentSkill[]>
  listWorkspace?: (folderRoot: string) => Promise<AgentSkill[]>
  update?: (input: AgentSkillWriteInput) => Promise<AgentSkill>
  updateWorkspace?: (folderRoot: string, input: AgentSkillWriteInput) => Promise<AgentSkill>
}

function getSkillsApi(): SkillsListApi | undefined {
  return (window.api as { skills?: SkillsListApi }).skills
}

function SkillIconGrid({
  skills,
  icon,
  iconForSkill,
  badgeForSkill,
  launching,
  onLaunch,
  onEdit,
  editLabel
}: {
  skills: AgentSkill[]
  icon?: React.ReactNode
  iconForSkill?: (skill: AgentSkill) => React.ReactNode
  badgeForSkill?: (skill: AgentSkill) => string | undefined
  launching: boolean
  onLaunch: (skill: AgentSkill) => void
  onEdit: (skill: AgentSkill) => void
  editLabel: string
}) {
  if (skills.length === 0) return null
  return (
    <div className={styles.iconGrid}>
      {skills.map((skill) => {
        const badge = badgeForSkill?.(skill)
        return (
          <div key={`${skill.source ?? 'software'}:${skill.name}`} className={styles.iconCard}>
            <button
              type="button"
              className={styles.iconCardMain}
              disabled={launching}
              onClick={() => onLaunch(skill)}
            >
              <span className={styles.iconBadge} aria-hidden>
                {iconForSkill?.(skill) ?? icon}
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitleRow}>
                  <span className={styles.cardTitle}>/{skill.name}</span>
                  {badge ? <span className={styles.skillTag}>{badge}</span> : null}
                </span>
                <span className={styles.cardDesc}>{skill.description || skill.name}</span>
              </span>
            </button>
            <button
              type="button"
              className={styles.editBtn}
              disabled={launching}
              title={editLabel}
              aria-label={editLabel}
              onClick={(event) => {
                event.stopPropagation()
                onEdit(skill)
              }}
            >
              <Pencil size={13} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export const WorkbenchSkillsPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const toast = useToast()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolveWorkbenchSkillsPageTab(searchParams.get('tab'))
  const [launchIntent, setLaunchIntent] = useState<'skill' | 'template'>('skill')
  const [launchDisplayName, setLaunchDisplayName] = useState('')
  const projectParam = searchParams.get('project')
  const [query, setQuery] = useState('')
  const [launching, setLaunching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [launchSkillTarget, setLaunchSkillTarget] = useState<AgentSkill | null>(null)
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null)
  const [savingSkill, setSavingSkill] = useState(false)
  const [listedSkills, setListedSkills] = useState<AgentSkill[]>([])
  const [projectSkills, setProjectSkills] = useState<AgentSkill[]>([])
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [loadingProjectSkills, setLoadingProjectSkills] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsWorkspace, setSettingsWorkspace] = useState<{
    id: string
    displayName: string
  } | null>(null)
  const {
    workspaces,
    lastActiveWorkspaceId,
    loading: loadingWorkspaces,
    addWorkspaceFromPicker,
    ensureScratchWorkspace,
    refresh,
    selectWorkspace,
    removeWorkspace,
    setWorkspacePinned
  } = useAgentWorkspaces()
  const { sessions, reloadSessions, pinSession } = useWorkspaceSessions()
  const chrome = useAgentWorkspaceChrome()
  const settings = useSettingsPaneApi()
  const ensureConfigForSegment = useSettingsStore((s) => s.ensureConfigForSegment)

  const sortedWorkspaces = useMemo(
    () => sortAgentWorkspaces(workspaces, lastActiveWorkspaceId),
    [lastActiveWorkspaceId, workspaces]
  )
  const selectedWorkspace = useMemo(
    () => sortedWorkspaces.find((entry) => entry.id === projectParam) ?? null,
    [projectParam, sortedWorkspaces]
  )
  const scopeId = selectedWorkspace?.id ?? GLOBAL_SKILL_SCOPE
  const waitingForProject = Boolean(projectParam) && loadingWorkspaces && !selectedWorkspace

  const setTab = useCallback(
    (next: 'skill' | 'template' | 'mcp') => {
      const nextParams = new URLSearchParams(searchParams)
      if (next === 'skill') nextParams.delete('tab')
      else nextParams.set('tab', next)
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const setScope = useCallback(
    (next: string) => {
      const nextParams = new URLSearchParams(searchParams)
      if (!next || next === GLOBAL_SKILL_SCOPE) nextParams.delete('project')
      else nextParams.set('project', next)
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  useEffect(() => {
    setFolderRoot(null)
  }, [setFolderRoot])

  useEffect(() => {
    if (tab !== 'mcp') return
    void ensureConfigForSegment('mcp')
  }, [ensureConfigForSegment, tab])

  useEffect(() => {
    if (tab !== 'skill') return
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
  }, [tab])

  useEffect(() => {
    if (tab !== 'skill') return
    if (waitingForProject) {
      setLoadingProjectSkills(true)
      setProjectSkills([])
      return
    }
    if (scopeId === GLOBAL_SKILL_SCOPE) {
      setProjectSkills([])
      setLoadingProjectSkills(false)
      return
    }
    let cancelled = false
    setLoadingProjectSkills(true)
    setProjectSkills([])
    const folderRoot = selectedWorkspace?.folderRoot ?? ''
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
  }, [scopeId, selectedWorkspace?.folderRoot, tab, waitingForProject])

  useEffect(() => {
    if (!projectParam || loadingWorkspaces || selectedWorkspace) return
    setScope(GLOBAL_SKILL_SCOPE)
  }, [loadingWorkspaces, projectParam, selectedWorkspace, setScope])

  const scopeOptions = useMemo(
    () => [
      {
        value: GLOBAL_SKILL_SCOPE,
        label: t('workbench.skills_scope_global', '全局')
      },
      ...sortedWorkspaces.map((entry) => ({
        value: entry.id,
        label: entry.displayName
      }))
    ],
    [sortedWorkspaces, t]
  )

  const visibleTemplates = useMemo(
    () =>
      WORKBENCH_SKILL_CARDS.filter((card) =>
        matchesWorkbenchSkillSearch(query, {
          name: card.name,
          title: t(card.titleKey, card.titleFallback),
          description: t(card.descriptionKey, card.descriptionFallback)
        })
      ),
    [query, t]
  )

  const skillMatchesQuery = useCallback(
    (skill: AgentSkill): boolean => {
      return matchesWorkbenchSkillSearch(query, {
        name: skill.name,
        title: skill.description || skill.name,
        description: skill.description || skill.name
      })
    },
    [query]
  )

  const visibleOfficialAndUser = useMemo(
    () => omitHiddenBundledTemplateSkills(listedSkills).filter(skillMatchesQuery),
    [listedSkills, skillMatchesQuery]
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
        scope: scopeId === GLOBAL_SKILL_SCOPE ? 'global' : 'project',
        userSkills,
        projectSkills: visibleProjectSkills
      }),
    [scopeId, userSkills, visibleProjectSkills]
  )

  const officialIconSkills = useMemo(
    () =>
      ensureOfficialCreateSkill(officialSkills, {
        name: CREATE_SKILL_SLASH_COMMAND,
        description: CREATE_SKILL_SLASH_COMMAND,
        content: getCreateSkillGuidePrompt(t),
        location: '',
        source: 'software'
      }).filter(skillMatchesQuery),
    [officialSkills, skillMatchesQuery, t]
  )

  const handleOpenFolder = useCallback(async () => {
    setCreating(true)
    try {
      const entry = await addWorkspaceFromPicker()
      if (!entry) return
      setFolderRoot(entry.folderRoot)
      navigate(`/agent-workspace/open/${entry.id}`)
    } catch (error) {
      console.error('[WorkbenchSkillsPage] add workspace failed:', error)
      await dialog.alert(
        error instanceof Error
          ? error.message
          : t('agent_workspace.add_workspace_failed', '添加工作区失败，请重启应用后重试'),
        t('workbench.home_new_project', '新建项目')
      )
    } finally {
      setCreating(false)
    }
  }, [addWorkspaceFromPicker, dialog, navigate, setFolderRoot, t])

  const enterWorkspace = useCallback(
    async (workspaceId: string) => {
      const target = workspaces.find((entry) => entry.id === workspaceId)
      if (!target) return
      await selectWorkspace(workspaceId)
      setFolderRoot(target.folderRoot)
      navigate(`/agent-workspace/open/${workspaceId}`)
    },
    [navigate, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleOpenSession = useCallback(
    async (sessionId: string, workspaceId: string) => {
      const target = workspaces.find((entry) => entry.id === workspaceId)
      if (!target) return
      await selectWorkspace(workspaceId)
      setFolderRoot(target.folderRoot)
      navigate(`/agent-workspace/${sessionId}`)
    },
    [navigate, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const confirmed = await dialog.confirm(
        t(
          'agent_workspace.delete_session_confirm',
          '确定删除此工作区会话？相关对话记录也会被移除。'
        ),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return
      try {
        await window.api.agentWorkspace.deleteSession(sessionId)
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
        await reloadSessions()
      } catch (error) {
        console.error('[WorkbenchSkillsPage] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, reloadSessions, t]
  )

  const handleOpenSettings = useCallback(async () => {
    try {
      const scratch = await ensureScratchWorkspace()
      await refresh()
      setSettingsWorkspace({ id: scratch.id, displayName: scratch.displayName })
      setSettingsOpen(true)
    } catch (error) {
      console.error('[WorkbenchSkillsPage] ensure scratch for settings failed:', error)
      navigate(`${SETTINGS_HUB_PREFIX}/general`)
    }
  }, [ensureScratchWorkspace, navigate, refresh])

  const launchSkill = useCallback(
    async (skill: AgentSkill, folderRoot?: string) => {
      if (launching) return
      setLaunching(true)
      try {
        let entryFolder = folderRoot?.trim() || ''
        if (!entryFolder) {
          const entry = await addWorkspaceFromPicker()
          if (!entry) return
          entryFolder = entry.folderRoot
        } else {
          const matched = workspaces.find((item) => item.folderRoot === entryFolder)
          if (matched) await selectWorkspace(matched.id)
        }

        setFolderRoot(entryFolder)
        const content =
          skill.content.trim() ||
          (skill.name === WRITER_SKILL_NAME ? WRITER_SKILL_CONTENT : '')
        const payload = buildSkillSendMeta({ name: skill.name, content })
        const sessionId = await window.api.agentWorkspace.createSession({
          folderRoot: entryFolder,
          assistantId: chrome.selectedAssistantId,
          providerId: chrome.model.currentProviderId,
          modelId: chrome.model.currentModelId
        })
        stashWorkspaceInitMeta(sessionId, payload)
        navigate(`/agent-workspace/${sessionId}?init=${encodeURIComponent(payload.text)}`)
      } catch (error) {
        console.error('[WorkbenchSkillsPage] launch skill failed:', error)
        await dialog.alert(
          error instanceof Error
            ? error.message
            : t('workbench.skills_launch_failed', '打开技能失败'),
          skill.description || skill.name
        )
      } finally {
        setLaunching(false)
      }
    },
    [
      addWorkspaceFromPicker,
      chrome.model.currentModelId,
      chrome.model.currentProviderId,
      chrome.selectedAssistantId,
      dialog,
      launching,
      navigate,
      selectWorkspace,
      setFolderRoot,
      t,
      workspaces
    ]
  )

  const beginUseSkill = useCallback((skill: AgentSkill) => {
    if (launching) return
    setLaunchIntent('skill')
    setLaunchDisplayName(skill.name)
    setLaunchSkillTarget(skill)
  }, [launching])

  const beginUseTemplate = useCallback(
    (card: (typeof WORKBENCH_SKILL_CARDS)[number]) => {
      if (launching) return
      setLaunchIntent('template')
      setLaunchDisplayName(t(card.titleKey, card.titleFallback))
      setLaunchSkillTarget({
        name: card.name,
        description: t(card.descriptionKey, card.descriptionFallback),
        content: card.name === WRITER_SKILL_NAME ? WRITER_SKILL_CONTENT : '',
        location: '',
        source: 'software'
      })
    },
    [launching, t]
  )

  const handlePickLaunchWorkspace = useCallback(
    (workspace: AgentWorkspaceEntry) => {
      if (!launchSkillTarget) return
      const skill = launchSkillTarget
      setLaunchSkillTarget(null)
      void launchSkill(skill, workspace.folderRoot)
    },
    [launchSkill, launchSkillTarget]
  )

  const handleLaunchOpenFolder = useCallback(() => {
    if (!launchSkillTarget) return
    const skill = launchSkillTarget
    setLaunchSkillTarget(null)
    void launchSkill(skill)
  }, [launchSkill, launchSkillTarget])

  const handleSaveSkill = useCallback(
    async (input: { name: string; description: string; content: string }) => {
      if (!editingSkill || savingSkill) return
      const scope = resolveSkillEditScope(editingSkill.source)
      const workspaceFolder = selectedWorkspace?.folderRoot
      if (scope === 'workspace' && !workspaceFolder) {
        await dialog.alert(
          t('workbench.skills_edit_missing_project', '请先选择项目再编辑项目技能'),
          t('workbench.skills_edit', '编辑')
        )
        return
      }
      setSavingSkill(true)
      try {
        const payload: AgentSkillWriteInput = {
          previousName: editingSkill.name,
          name: input.name,
          description: input.description,
          content: input.content
        }
        const skillsApi = getSkillsApi()
        if (scope === 'workspace' && workspaceFolder) {
          if (!skillsApi?.updateWorkspace) throw new Error(t('workbench.skills_edit_failed', '保存技能失败'))
          await skillsApi.updateWorkspace(workspaceFolder, payload)
        } else {
          if (!skillsApi?.update) throw new Error(t('workbench.skills_edit_failed', '保存技能失败'))
          await skillsApi.update(payload)
        }
        toast.showSuccess(t('workbench.skills_edit_saved', '已保存技能'))
        setEditingSkill(null)
      } catch (error) {
        console.error('[WorkbenchSkillsPage] save skill failed:', error)
        await dialog.alert(
          error instanceof Error
            ? error.message
            : t('workbench.skills_edit_failed', '保存技能失败'),
          t('workbench.skills_edit', '编辑')
        )
      } finally {
        setSavingSkill(false)
      }
    },
    [dialog, editingSkill, savingSkill, selectedWorkspace, t, toast]
  )

  const editLabel = t('workbench.skills_edit', '编辑')

  return (
    <div className={pageStyles.page}>
      <WorkbenchHomeSidebar
        activeNav="skills"
        onNewProject={() => void handleOpenFolder()}
        onOpenHome={() => navigate('/agent-workspace')}
        onOpenKnowledge={() => navigate('/agent-workspace/knowledge')}
        onOpenSkills={() => navigate('/agent-workspace/skills')}
        onOpenProjects={() => navigate('/agent-workspace/projects')}
        onOpenSettings={() => void handleOpenSettings()}
        creating={creating || launching}
        recentWorkspaces={workspaces}
        lastActiveWorkspaceId={lastActiveWorkspaceId}
        sessions={sessions}
        onOpenWorkspace={(id) => void enterWorkspace(id)}
        onOpenSession={(sessionId, workspaceId) => void handleOpenSession(sessionId, workspaceId)}
        onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
        onRemoveWorkspace={removeWorkspace}
        onTogglePinWorkspace={(id, pinned) => setWorkspacePinned(id, pinned)}
        onTogglePinSession={pinSession}
      />

      <main className={pageStyles.main}>
        <div className={styles.inner}>
          <div className={styles.tabBar}>
            <SegmentedControl
              value={tab}
              options={[
                { value: 'skill', label: t('workbench.skills_tab_skill', 'Skill') },
                { value: 'template', label: t('workbench.skills_tab_template', '模板') },
                { value: 'mcp', label: t('workbench.skills_tab_mcp', 'MCP') }
              ]}
              onChange={setTab}
              aria-label={t('workbench.home_skills', '技能')}
            />
          </div>

          {tab === 'template' ? (
            <>
              <header className={styles.hero}>
                <h1 className={styles.title}>{t('workbench.templates_title', '模板')}</h1>
                <p className={styles.subtitle}>
                  {t('workbench.templates_subtitle', '用模板快速创建一个项目空间')}
                </p>
              </header>

              <label className={styles.search}>
                <Search className={styles.searchIcon} size={16} strokeWidth={2} aria-hidden />
                <Input
                  fieldSize="small"
                  type="search"
                  inputClassName={styles.searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('workbench.templates_search', '搜索模板')}
                  aria-label={t('workbench.templates_search', '搜索模板')}
                />
              </label>

              {visibleTemplates.length === 0 ? (
                <p className={styles.empty}>{t('workbench.templates_empty', '没有匹配的模板')}</p>
              ) : (
                <div className={styles.grid}>
                  {visibleTemplates.map((card) => (
                    <div key={card.name} className={styles.card}>
                      <button
                        type="button"
                        className={styles.cardMain}
                        disabled={launching}
                        onClick={() => beginUseTemplate(card)}
                      >
                        <span className={styles.cover}>
                          <img src={card.image} alt="" />
                        </span>
                        <span className={styles.cardBody}>
                          <span className={styles.cardTitle}>
                            {t(card.titleKey, card.titleFallback)}
                          </span>
                          <span className={styles.cardDesc}>
                            {t(card.descriptionKey, card.descriptionFallback)}
                          </span>
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === 'skill' ? (
            <>
              <header className={styles.hero}>
                <h1 className={styles.title}>{t('workbench.skills_title', '技能')}</h1>
                <p className={styles.subtitle}>
                  {t('workbench.skills_subtitle', '通过任务专用技能扩展工作台的能力')}
                </p>
              </header>

              <label className={styles.search}>
                <Search className={styles.searchIcon} size={16} strokeWidth={2} aria-hidden />
                <Input
                  fieldSize="small"
                  type="search"
                  inputClassName={styles.searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('workbench.skills_search', '搜索技能')}
                  aria-label={t('workbench.skills_search', '搜索技能')}
                />
              </label>

              <section className={styles.section}>
                <h2 className={styles.sectionLabel}>
                  {t('workbench.skills_official', '官方技能')}
                </h2>
                {loadingSkills ? (
                  <p className={styles.empty}>{t('workbench.skills_loading', '正在加载技能')}</p>
                ) : officialIconSkills.length === 0 ? (
                  <p className={styles.empty}>
                    {t('workbench.skills_empty_official', '没有匹配的官方技能')}
                  </p>
                ) : (
                  <SkillIconGrid
                    skills={officialIconSkills}
                    icon={<Sparkles size={14} strokeWidth={2} />}
                    launching={launching}
                    editLabel={editLabel}
                    onLaunch={beginUseSkill}
                    onEdit={setEditingSkill}
                  />
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionLabel}>
                    {t('workbench.skills_project_section', '项目技能')}
                  </h2>
                  <div className={styles.sectionFilter}>
                    <Select
                      value={waitingForProject ? projectParam ?? GLOBAL_SKILL_SCOPE : scopeId}
                      options={scopeOptions}
                      size="small"
                      leading={
                        waitingForProject || scopeId !== GLOBAL_SKILL_SCOPE ? (
                          <FolderOpen size={14} strokeWidth={2} aria-hidden />
                        ) : (
                          <Globe size={14} strokeWidth={2} aria-hidden />
                        )
                      }
                      aria-label={t('workbench.skills_scope', '范围')}
                      onChange={(event) => setScope(event.target.value)}
                    />
                  </div>
                </div>
                {waitingForProject ||
                loadingSkills ||
                (scopeId !== GLOBAL_SKILL_SCOPE && loadingProjectSkills) ? (
                  <p className={styles.empty}>{t('workbench.skills_loading', '正在加载技能')}</p>
                ) : scopedSkills.length === 0 ? (
                  <p className={styles.empty}>
                    {scopeId === GLOBAL_SKILL_SCOPE
                      ? query.trim()
                        ? t('workbench.skills_empty_custom_search', '没有匹配的自定义技能')
                        : t('workbench.skills_empty_custom', '还没有自定义技能')
                      : query.trim()
                        ? t('workbench.skills_empty_project_search', '没有匹配的项目技能')
                        : t(
                            'workbench.skills_empty_project',
                            '这个项目的 skill 或 skills 目录里还没有技能'
                          )}
                  </p>
                ) : (
                  <SkillIconGrid
                    skills={scopedSkills}
                    icon={
                      scopeId === GLOBAL_SKILL_SCOPE ? (
                        <Globe size={14} strokeWidth={2} />
                      ) : (
                        <FolderOpen size={14} strokeWidth={2} />
                      )
                    }
                    launching={launching}
                    editLabel={editLabel}
                    onLaunch={beginUseSkill}
                    onEdit={setEditingSkill}
                  />
                )}
              </section>
            </>
          ) : (
            <>
              <header className={styles.hero}>
                <h1 className={styles.title}>{t('settings.mcp_title', 'MCP 服务')}</h1>
                <p className={styles.subtitle}>
                  {t('workbench.skills_mcp_subtitle', '管理本机 MCP 服务与当前提供的工具')}
                </p>
              </header>
              <McpSettingsPane settings={settings} embedded />
            </>
          )}
        </div>
      </main>

      <WorkbenchSkillLaunchDialog
        open={launchSkillTarget !== null}
        skillName={launchIntent === 'template' ? launchDisplayName : launchSkillTarget?.name ?? ''}
        intent={launchIntent}
        workspaces={sortedWorkspaces}
        preferredWorkspaceId={selectedWorkspace?.id}
        busy={launching}
        onClose={() => setLaunchSkillTarget(null)}
        onPickWorkspace={handlePickLaunchWorkspace}
        onOpenFolder={handleLaunchOpenFolder}
      />
      <WorkbenchSkillEditorDialog
        open={editingSkill !== null}
        skill={editingSkill}
        busy={savingSkill}
        onClose={() => {
          if (!savingSkill) setEditingSkill(null)
        }}
        onSave={(input) => void handleSaveSkill(input)}
      />
      {settingsWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={settingsOpen}
          workspaceId={settingsWorkspace.id}
          workspaceName={settingsWorkspace.displayName}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
