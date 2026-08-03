import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { InputBar, Select, type PromptShortcut } from '@baishou/ui'
import type { AgentGateApprovalPreset } from '@baishou/shared'
import { Folder, ShieldCheck } from 'lucide-react'
import styles from './WorkbenchHomeComposer.module.css'

const OPEN_FOLDER_VALUE = '__open_folder__'

export interface WorkbenchHomeComposerProps {
  workspaceOptions: Array<{ value: string; label: string }>
  workspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onOpenFolder: () => void
  approvalPreset: AgentGateApprovalPreset
  onApprovalChange: (preset: AgentGateApprovalPreset) => void
  onOpenWorkspaceSettings: () => void
  onSend: (text: string) => boolean | Promise<boolean>
  shortcuts?: PromptShortcut[]
  onManageShortcuts?: () => void
  sending?: boolean
}

export const WorkbenchHomeComposer: React.FC<WorkbenchHomeComposerProps> = ({
  workspaceOptions,
  workspaceId,
  onWorkspaceChange,
  onOpenFolder,
  approvalPreset,
  onApprovalChange,
  onOpenWorkspaceSettings,
  onSend,
  shortcuts,
  onManageShortcuts,
  sending
}) => {
  const { t } = useTranslation()

  const wsOptions = useMemo(
    () => [
      ...workspaceOptions,
      {
        value: OPEN_FOLDER_VALUE,
        label: t('workbench.home_open_folder_option', '打开文件夹…')
      }
    ],
    [t, workspaceOptions]
  )

  const approvalOptions = useMemo(() => {
    const base = [
      {
        value: 'always_ask',
        label: t('workbench.home_default_permissions', '默认权限')
      },
      {
        value: 'dangerous_only',
        label: t('settings.agent_gate_approval_dangerous', '仅危险操作问')
      },
      {
        value: 'never_ask',
        label: t('settings.agent_gate_approval_never', '不问（自动接受）')
      }
    ]
    if (approvalPreset === 'custom') {
      base.push({
        value: 'custom',
        label: t('settings.agent_gate_preset_custom', '自定义')
      })
    }
    return base
  }, [approvalPreset, t])

  const footer = (
    <div className={styles.selectors}>
      <Select
        variant="ghost"
        size="small"
        className={styles.metaSelect}
        leading={<Folder size={15} strokeWidth={1.75} aria-hidden />}
        value={workspaceId ?? ''}
        options={wsOptions}
        placeholder={t('workbench.home_select_workspace', '选择工作空间')}
        onChange={(event) => {
          const next = event.target.value
          if (next === OPEN_FOLDER_VALUE) {
            onOpenFolder()
            return
          }
          onWorkspaceChange(next)
        }}
        aria-label={t('workbench.home_select_workspace', '选择工作空间')}
      />
      <Select
        variant="ghost"
        size="small"
        className={styles.metaSelect}
        leading={<ShieldCheck size={15} strokeWidth={1.75} aria-hidden />}
        value={approvalPreset}
        options={approvalOptions}
        placeholder={t('workbench.home_default_permissions', '默认权限')}
        onChange={(event) => {
          const next = event.target.value as AgentGateApprovalPreset
          if (next === 'custom') return
          onApprovalChange(next)
        }}
        aria-label={t('settings.agent_gate_approval_preset', '审批时机')}
      />
      {approvalPreset === 'custom' ? (
        <p className={styles.customHint}>
          {t('workbench.home_custom_gate_hint', '当前为自定义权限')}
          <button type="button" className={styles.customLink} onClick={onOpenWorkspaceSettings}>
            {t('workbench.home_open_gate_settings', '打开设置')}
          </button>
        </p>
      ) : null}
    </div>
  )

  return (
    <section className={styles.composer} aria-label={t('workbench.home_composer', '开始对话')}>
      <div className={styles.inputWrap}>
        <InputBar
          isLoading={Boolean(sending)}
          onSend={onSend}
          shortcuts={shortcuts}
          onManageShortcuts={onManageShortcuts}
          placeholder={t(
            'workbench.home_input_placeholder',
            '今天帮你做些什么？@ 引用文件，/ 调用技能与指令'
          )}
          minRows={3}
          sendIconSize={19}
          footer={footer}
        />
      </div>
    </section>
  )
}
