export const sharedTokens = {
  fontFamily: "'Noto Sans SC', 'Noto Sans', system-ui, sans-serif",
  radius: {
    sm: 4,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },
  animation: {
    fast: 150,
    normal: 250
  }
}

/**
 * 设置页字号/字重阶梯（与 css-variables.css `--settings-font-*` 对齐）
 * 桌面 CSS 用变量；移动 RN 可直接引用本对象，避免再写散落字号。
 */
export const settingsTypography = {
  /** 侧栏壳标题「系统设置」 */
  shellTitle: { fontSize: 22, fontWeight: '600' as const },
  /** 内容区页标题（SettingsPageChrome） */
  pageTitle: { fontSize: 18, fontWeight: '600' as const },
  /** 卡内区块标题 */
  section: { fontSize: 15, fontWeight: '600' as const },
  /** 侧栏导航项 */
  nav: { fontSize: 14, fontWeight: '500' as const },
  /** 列表行标题 / 正文 */
  row: { fontSize: 14, fontWeight: '400' as const },
  /** 表单标签、chip */
  label: { fontSize: 13, fontWeight: '500' as const },
  /** 行说明 / 次要文案 */
  desc: { fontSize: 13, fontWeight: '400' as const },
  /** 侧栏分组、hint */
  meta: { fontSize: 12, fontWeight: '500' as const },
  /** badge / 极次要，少用 */
  micro: { fontSize: 11, fontWeight: '600' as const }
} as const

/**
 * 设置页图标尺寸（与 css-variables.css `--settings-icon-*` 对齐）
 * ListTile leading 用 leading；右侧箭头 / 外链用 trailing。
 */
export const settingsIcons = {
  leading: 20,
  trailing: 18,
  leadingSlot: 32
} as const
