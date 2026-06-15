import React from 'react'
import { useTranslation } from 'react-i18next'

export const ShortcutSlashHint: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={className}
      style={{
        margin: 0,
        padding: '10px 14px',
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--text-secondary)',
        background: 'rgba(var(--color-primary-rgb, 91, 168, 245), 0.08)',
        border: '1px solid rgba(var(--color-primary-rgb, 91, 168, 245), 0.18)',
        ...style
      }}
    >
      {t(
        'shortcut.input_slash_hint',
        '在空输入框输入 / 可快速匹配快捷指令；继续输入可过滤，按回车或点击条目即可插入正文。'
      )}
    </div>
  )
}
