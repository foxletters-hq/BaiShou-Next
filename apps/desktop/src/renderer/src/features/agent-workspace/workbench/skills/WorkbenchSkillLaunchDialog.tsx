import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen } from 'lucide-react'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { Modal } from '@baishou/ui'
import { orderSkillLaunchWorkspaces } from '../../utils/workspace-skill-launch.util'
import styles from './WorkbenchSkillLaunchDialog.module.css'

export const WorkbenchSkillLaunchDialog: React.FC<{
  open: boolean
  skillName: string
  intent?: 'skill' | 'template'
  workspaces: AgentWorkspaceEntry[]
  preferredWorkspaceId?: string | null
  busy: boolean
  onClose: () => void
  onPickWorkspace: (workspace: AgentWorkspaceEntry) => void
  onOpenFolder: () => void
}> = ({
  open,
  skillName,
  intent = 'skill',
  workspaces,
  preferredWorkspaceId,
  busy,
  onClose,
  onPickWorkspace,
  onOpenFolder
}) => {
  const { t } = useTranslation()
  const ordered = useMemo(
    () => orderSkillLaunchWorkspaces(workspaces, preferredWorkspaceId),
    [preferredWorkspaceId, workspaces]
  )
  const title =
    intent === 'template'
      ? t('workbench.templates_use_title', {
          name: skillName,
          defaultValue: '用「{{name}}」创建项目'
        })
      : t('workbench.skills_use_title', { name: skillName, defaultValue: '使用 /{{name}}' })
  const hint =
    intent === 'template'
      ? t('workbench.templates_use_hint', '选择一个项目，或打开一个新的文件夹来创建这个模板')
      : t('workbench.skills_use_hint', '选择要使用该技能的项目，或打开一个新的文件夹')

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick={!busy}
      animation="fade"
      title={title}
    >
      <div className={styles.body}>
        <p className={styles.hint}>{hint}</p>
        {ordered.length === 0 ? (
          <p className={styles.empty}>
            {t('workbench.skills_use_empty_projects', '还没有项目，请先打开一个文件夹')}
          </p>
        ) : (
          <ul className={styles.list}>
            {ordered.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  className={`${styles.projectBtn} ${
                    workspace.id === preferredWorkspaceId ? styles.projectBtnPreferred : ''
                  }`}
                  disabled={busy}
                  onClick={() => onPickWorkspace(workspace)}
                >
                  <span className={styles.projectName}>{workspace.displayName}</span>
                  <span className={styles.projectPath}>{workspace.folderRoot}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onClose}>
            {t('common.cancel', '取消')}
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onOpenFolder}>
            <FolderOpen size={14} strokeWidth={2} aria-hidden />
            {t('workbench.skills_use_open_folder', '打开文件夹')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
