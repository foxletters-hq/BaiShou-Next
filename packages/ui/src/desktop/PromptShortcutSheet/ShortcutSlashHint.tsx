import React from 'react'
import { useTranslation } from 'react-i18next'

export const ShortcutSlashHint: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style
}) => {
  const { t } = useTranslation()

  return (
    <p className={className} style={style}>
      {t(
        'shortcut.manager_panel_hint',
        '浏览、编辑或删除已有 Skill。也可从加号菜单选择「创建 Skill」，由 AI 引导完成。空输入框输入 / 可快速匹配并插入。'
      )}
    </p>
  )
}
