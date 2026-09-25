import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Switch, toast } from '@baishou/ui'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import pane from '../../settings/components/GeneralSettingsPane.module.css'
import {
  clearAllWorkbenchDontAskAgain,
  hasAnyWorkbenchDontAskAgain
} from '../utils/workspace-dont-ask-again.util'

export interface WorkbenchGeneralSettingsPaneProps {
  workspaceId: string
}

/** 工作台设置「通用」：个人记忆，以及恢复本机已勾选的不再提示。 */
export const WorkbenchGeneralSettingsPane: React.FC<WorkbenchGeneralSettingsPaneProps> = ({
  workspaceId
}) => {
  const { t } = useTranslation()
  const [hasSkipped, setHasSkipped] = useState(hasAnyWorkbenchDontAskAgain)
  const [personalMemoryReadEnabled, setPersonalMemoryReadEnabled] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    void window.api.settings
      .getWorkspacePersonalMemoryRead(workspaceId)
      .then((enabled) => {
        if (!cancelled) setPersonalMemoryReadEnabled(enabled !== false)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const handlePersonalMemoryChange = useCallback(
    async (enabled: boolean) => {
      const previous = personalMemoryReadEnabled
      setPersonalMemoryReadEnabled(enabled)
      try {
        const saved = await window.api.settings.setWorkspacePersonalMemoryRead(workspaceId, enabled)
        setPersonalMemoryReadEnabled(saved)
      } catch (e) {
        setPersonalMemoryReadEnabled(previous)
        toast.showError(String((e as Error)?.message || e))
      }
    },
    [personalMemoryReadEnabled, workspaceId]
  )

  const handleReset = useCallback(() => {
    const cleared = clearAllWorkbenchDontAskAgain()
    setHasSkipped(hasAnyWorkbenchDontAskAgain())
    if (cleared <= 0) {
      toast.showInfo(t('workbench.reset_dont_ask_again_empty', '当前没有已关闭的提示'))
      return
    }
    toast.showSuccess(t('workbench.reset_dont_ask_again_done', '已恢复确认提示'))
  }, [t])

  return (
    <div className={pane.stack}>
      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('workbench.personal_memory_section', '个人记忆')}
          </h3>
        </div>
        <section className={pane.cardSection}>
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('workbench.personal_memory_access', '允许读取个人记忆')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'workbench.personal_memory_access_desc',
                  '开启后，工作台伙伴可按需只读日记、回忆总结、向量记忆和跨会话检索，不会写入或删除。关闭后从下一轮对话生效，已进入当前会话的内容不会清除。身份卡与已挂载知识库不受影响。'
                )}
              </span>
            </div>
            <Switch
              checked={personalMemoryReadEnabled}
              aria-label={t('workbench.personal_memory_access', '允许读取个人记忆')}
              onChange={(event) => void handlePersonalMemoryChange(event.target.checked)}
            />
          </div>
        </section>
      </div>
      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('workbench.reset_dont_ask_again_section', '确认提示')}
          </h3>
        </div>
        <section className={pane.cardSection}>
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('workbench.reset_dont_ask_again', '恢复所有不再提示')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'workbench.reset_dont_ask_again_desc',
                  '恢复后，编辑重发、移动文件、从列表移除最近项目时会再次弹出确认。'
                )}
              </span>
            </div>
            <Button
              type="button"
              variant="outlined"
              size="small"
              disabled={!hasSkipped}
              onClick={handleReset}
            >
              {t('settings.reset_default', '恢复默认')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
