import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  WRITER_SKILL_CONTENT,
  WRITER_SKILL_NAME,
  type AgentSkill,
  type AgentSkillWriteInput,
  type AgentWorkspaceEntry
} from '@baishou/shared'
import { SegmentedControl, useDialog, useToast } from '@baishou/ui'
import { useSettingsPaneApi, useSettingsStore } from '@baishou/store'
import { McpSettingsPane } from '../../../settings/components/McpSettingsPane'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from '../../hooks/useAgentWorkspaceChrome'
import { sortAgentWorkspaces } from '../../utils/workspace-display.util'
import { stashWorkspaceInitMeta } from '../../utils/workspace-init-meta.util'
import {
  buildSkillSendMeta,
  isWorkbenchSkillEditable,
  matchesWorkbenchSkillSearch,
  resolveSkillEditScope,
  resolveWorkbenchSkillsPageTab
} from '../../utils/workspace-skill-launch.util'
import { WorkbenchSkillEditorDialog } from './WorkbenchSkillEditorDialog'
import { WorkbenchSkillLaunchDialog } from './WorkbenchSkillLaunchDialog'
import pageStyles from '../home/WorkbenchHomePage.module.css'
import { WORKBENCH_SKILL_CARDS } from './workbench-skill-catalog'
import { getSkillsApi, useWorkbenchSkillsCatalog } from './useWorkbenchSkillsCatalog'
import { WorkbenchSkillsSkillTab, GLOBAL_SKILL_SCOPE } from './WorkbenchSkillsSkillTab'
import { WorkbenchSkillsTemplateTab } from './WorkbenchSkillsTemplateTab'
import styles from './WorkbenchSkillsPage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
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
  const [launchSkillTarget, setLaunchSkillTarget] = useState<AgentSkill | null>(null)
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null)
  const [savingSkill, setSavingSkill] = useState(false)
  const {
    workspaces,
    lastActiveWorkspaceId,
    loading: loadingWorkspaces,
    addWorkspaceFromPicker,
    selectWorkspace
  } = useAgentWorkspaces()
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
  const catalog = useWorkbenchSkillsCatalog({
    tab,
    query,
    scopeId,
    folderRoot: selectedWorkspace?.folderRoot ?? '',
    waitingForProject
  })

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
          title: t(card.titleKey),
          description: t(card.descriptionKey)
        })
      ),
    [query, t]
  )

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
          skill.content.trim() || (skill.name === WRITER_SKILL_NAME ? WRITER_SKILL_CONTENT : '')
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

  const beginUseSkill = useCallback(
    (skill: AgentSkill) => {
      if (launching) return
      setLaunchIntent('skill')
      setLaunchDisplayName(skill.name)
      setLaunchSkillTarget(skill)
    },
    [launching]
  )

  const beginUseTemplate = useCallback(
    (card: (typeof WORKBENCH_SKILL_CARDS)[number]) => {
      if (launching) return
      setLaunchIntent('template')
      setLaunchDisplayName(t(card.titleKey))
      setLaunchSkillTarget({
        name: card.name,
        description: t(card.descriptionKey),
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
      if (!isWorkbenchSkillEditable(editingSkill)) return
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
          if (!skillsApi?.updateWorkspace)
            throw new Error(t('workbench.skills_edit_failed', '保存技能失败'))
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

  const handleEditSkill = useCallback((skill: AgentSkill) => {
    if (!isWorkbenchSkillEditable(skill)) return
    setEditingSkill(skill)
  }, [])

  const editLabel = t('workbench.skills_edit', '编辑')

  return (
    <div className={pageStyles.page}>
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
            <WorkbenchSkillsTemplateTab
              query={query}
              onQueryChange={setQuery}
              launching={launching}
              visibleTemplates={visibleTemplates}
              onUseTemplate={beginUseTemplate}
            />
          ) : tab === 'skill' ? (
            <WorkbenchSkillsSkillTab
              query={query}
              onQueryChange={setQuery}
              launching={launching}
              editLabel={editLabel}
              loadingSkills={catalog.loadingSkills}
              officialIconSkills={catalog.officialIconSkills}
              waitingForProject={waitingForProject}
              projectParam={projectParam}
              scopeId={scopeId}
              scopeOptions={scopeOptions}
              loadingProjectSkills={catalog.loadingProjectSkills}
              scopedSkills={catalog.scopedSkills}
              onLaunch={beginUseSkill}
              onEdit={handleEditSkill}
              onScopeChange={setScope}
            />
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
        skillName={
          launchIntent === 'template' ? launchDisplayName : (launchSkillTarget?.name ?? '')
        }
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
    </div>
  )
}
