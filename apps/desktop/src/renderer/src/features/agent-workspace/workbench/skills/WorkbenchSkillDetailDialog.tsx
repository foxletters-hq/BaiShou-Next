import React from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Globe, MessageCircle, Sparkles } from 'lucide-react'
import type { AgentSkill } from '@baishou/shared'
import { Button, Modal } from '@baishou/ui'
import { resolveWorkbenchSkillSection } from '../../utils/workspace-skill-launch.util'
import styles from './WorkbenchSkillDetailDialog.module.css'

export const WorkbenchSkillDetailDialog: React.FC<{
  open: boolean
  skill: AgentSkill | null
  busy?: boolean
  onClose: () => void
  onUseInProject: (skill: AgentSkill) => void
  onUseInCompanion: (skill: AgentSkill) => void
}> = ({ open, skill, busy = false, onClose, onUseInProject, onUseInCompanion }) => {
  const { t } = useTranslation()
  const section = skill ? resolveWorkbenchSkillSection(skill.source, skill.name) : 'official'
  const sourceLabel =
    section === 'project'
      ? t('workbench.skills_project_section', '项目技能')
      : section === 'user'
        ? t('workbench.skills_global_section', '全局技能')
        : t('workbench.skills_official', '官方技能')
  const content = skill?.content.trim() ?? ''
  const isProjectSkill = section === 'project'

  return (
    <Modal
      isOpen={open && Boolean(skill)}
      onClose={onClose}
      closeOnOverlayClick={!busy}
      animation="fade"
      className={styles.modal}
      title={t('workbench.skills_detail_title', '技能详情')}
    >
      {skill ? (
        <div className={styles.body}>
          <div className={styles.hero}>
            <span className={styles.icon} aria-hidden>
              {section === 'project' ? (
                <FolderOpen size={18} strokeWidth={1.8} />
              ) : section === 'user' ? (
                <Globe size={18} strokeWidth={1.8} />
              ) : (
                <Sparkles size={18} strokeWidth={1.8} />
              )}
            </span>
            <div className={styles.heading}>
              <div className={styles.titleRow}>
                <span className={styles.name}>/{skill.name}</span>
                <span className={styles.sourceTag}>{sourceLabel}</span>
              </div>
              <p className={styles.description}>{skill.description || skill.name}</p>
            </div>
          </div>

          {skill.location ? (
            <p className={styles.location} title={skill.location}>
              {skill.location}
            </p>
          ) : null}

          <div className={styles.contentSection}>
            <span className={styles.sectionLabel}>
              {t('workbench.skills_detail_content', '技能内容')}
            </span>
            <pre className={styles.content}>
              {content || t('workbench.skills_detail_content_empty', '这个技能没有正文内容')}
            </pre>
          </div>

          {isProjectSkill ? (
            <p className={styles.projectOnlyHint}>
              {t(
                'workbench.skills_detail_project_only',
                '项目技能依赖所属项目目录，只能在项目中使用'
              )}
            </p>
          ) : null}

          <div className={styles.footer}>
            <Button type="button" disabled={busy} onClick={onClose}>
              {t('common.cancel', '取消')}
            </Button>
            {isProjectSkill ? null : (
              <Button type="button" disabled={busy} onClick={() => onUseInCompanion(skill)}>
                <MessageCircle size={14} strokeWidth={2} aria-hidden />
                {t('workbench.skills_detail_use_companion', '在伙伴对话中使用')}
              </Button>
            )}
            <Button
              type="button"
              variant="elevated"
              disabled={busy}
              onClick={() => onUseInProject(skill)}
            >
              <FolderOpen size={14} strokeWidth={2} aria-hidden />
              {t('workbench.skills_detail_use_project', '在项目中使用')}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
