import React from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Globe, Search, Sparkles } from 'lucide-react'
import type { AgentSkill } from '@baishou/shared'
import { Input, Select } from '@baishou/ui'
import { WorkbenchSkillIconGrid } from './WorkbenchSkillIconGrid'
import styles from './WorkbenchSkillsPage.module.css'

export const GLOBAL_SKILL_SCOPE = 'global'

export function WorkbenchSkillsSkillTab({
  query,
  onQueryChange,
  launching,
  editLabel,
  loadingSkills,
  officialIconSkills,
  waitingForProject,
  projectParam,
  scopeId,
  scopeOptions,
  loadingProjectSkills,
  scopedSkills,
  onLaunch,
  onEdit,
  onScopeChange
}: {
  query: string
  onQueryChange: (value: string) => void
  launching: boolean
  editLabel: string
  loadingSkills: boolean
  officialIconSkills: AgentSkill[]
  waitingForProject: boolean
  projectParam: string | null
  scopeId: string
  scopeOptions: Array<{ value: string; label: string }>
  loadingProjectSkills: boolean
  scopedSkills: AgentSkill[]
  onLaunch: (skill: AgentSkill) => void
  onEdit: (skill: AgentSkill) => void
  onScopeChange: (scope: string) => void
}) {
  const { t } = useTranslation()
  return (
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
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('workbench.skills_search', '搜索技能')}
          aria-label={t('workbench.skills_search', '搜索技能')}
        />
      </label>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>{t('workbench.skills_official', '官方技能')}</h2>
        {loadingSkills ? (
          <p className={styles.empty}>{t('workbench.skills_loading', '正在加载技能')}</p>
        ) : officialIconSkills.length === 0 ? (
          <p className={styles.empty}>
            {t('workbench.skills_empty_official', '没有匹配的官方技能')}
          </p>
        ) : (
          <WorkbenchSkillIconGrid
            skills={officialIconSkills}
            icon={<Sparkles size={14} strokeWidth={2} />}
            launching={launching}
            editLabel={editLabel}
            onLaunch={onLaunch}
            onEdit={onEdit}
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
              value={waitingForProject ? (projectParam ?? GLOBAL_SKILL_SCOPE) : scopeId}
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
              onChange={(event) => onScopeChange(event.target.value)}
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
          <WorkbenchSkillIconGrid
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
            onLaunch={onLaunch}
            onEdit={onEdit}
          />
        )}
      </section>
    </>
  )
}
