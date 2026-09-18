import React from 'react'
import { Pencil } from 'lucide-react'
import type { AgentSkill } from '@baishou/shared'
import styles from './WorkbenchSkillsPage.module.css'

export function WorkbenchSkillIconGrid({
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
