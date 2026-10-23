export const sharedTokens = {
  /** Noto Sans SC = 思源黑体简体 */
  fontFamily: "'Noto Sans SC', 'Noto Sans', system-ui, sans-serif",
  /** 等宽；CJK 必须写在 generic 族名前，否则中文到不了思源 */
  fontFamilyMono:
    "'JetBrains Mono', 'Fira Code', 'Consolas', 'Noto Sans SC', 'Noto Sans', system-ui, sans-serif",
  radius: {
    /** 与 CSS `--radius-2xs` 对齐 */
    xxs: 2,
    /** 与 CSS `--radius-xs` 对齐；历史 `sm` 曾是 4 */
    xs: 4,
    xsPlus: 6,
    /** 与 CSS `--radius-sm` 对齐（8）。旧的 4 请用 `xs` */
    sm: 8,
    control: 10,
    md: 12,
    lg: 16,
    lgPlus: 20,
    xl: 24,
    full: 9999
  },
  spacing: {
    xxs: 2,
    xs: 4,
    xsPlus: 6,
    sm: 8,
    smPlus: 10,
    mdTight: 12,
    mdSnug: 14,
    md: 16,
    mdPlus: 20,
    lg: 24,
    xl: 32,
    xlPlus: 40,
    xxl: 48,
    xxxl: 64
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },
  animation: {
    instant: 100,
    fast: 150,
    swift: 200,
    normal: 250,
    moderate: 300,
    slow: 400
  }
}

/**
 * 全局 UI 字号四档（与 css-variables.css `--ui-fs-*` 对齐）
 * lg/xl 在 CSS 中挂到 `--content-font-size*` 以跟随用户缩放；此处给固定基准值。
 */
export const uiTypography = {
  sm: 12,
  md: 13,
  lg: 14,
  xl: 16
} as const

/**
 * 设置页字号/字重阶梯（与 css-variables.css `--settings-font-*` 对齐）
 * 桌面 CSS 用变量；移动 RN 可直接引用本对象，避免再写散落字号。
 */
export const settingsTypography = {
  /** 侧栏壳标题「系统设置」（与日记侧栏 brandName 对齐） */
  shellTitle: { fontSize: 16, fontWeight: '700' as const },
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

/**
 * 图标 / emoji 字号（与 css-variables.css `--icon-fs-*` 对齐）。
 * leading 行图标用 settingsIcons；其余 glyph 用本表。
 */
export const iconSizes = {
  xs: 10,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
  hero: 64
} as const

/**
 * 展示型大标题（与 css-variables.css `--ui-display-*` 对齐）。
 * 日记日号继续用 mobileTypography.display。
 */
export const displaySizes = {
  sm: 22,
  md: 28,
  lg: 36
} as const

/**
 * 移动端字号。数值与 css-variables.css 的 `--mobile-fs-*` / `--mobile-fw-*` 一致。
 * 全应用只使用这几档，不要按页面再写一套。
 */
export const mobileTypography = {
  /** 展示型大数字，如日记日号 */
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 32 },
  /** 页面标题、区块标题 */
  title: { fontSize: 17, fontWeight: '600' as const },
  /** 列表主行 */
  primary: { fontSize: 16, fontWeight: '500' as const },
  /** 阅读正文 */
  body: { fontSize: 15, lineHeight: 24 },
  /** 次要说明、元信息 */
  secondary: { fontSize: 13, fontWeight: '500' as const },
  /** 底栏、角标、标签 */
  caption: { fontSize: 11, fontWeight: '600' as const }
} as const

/**
 * Markdown 与富文本排版间距 Token。
 * 统一移动端对话气泡、AI 思考推理块、工具链与总结正文等场景的排版间距，消除硬编码。
 */
export const markdownSpacingTokens = {
  /** 正文与 AI 输出段落的标准下边距 */
  paragraph: sharedTokens.spacing.sm,
  /** 卡片预览极紧凑模式下的段落间距 */
  paragraphPreview: sharedTokens.spacing.xxs,
  /** 列表容器整体下边距 */
  list: sharedTokens.spacing.sm,
  /** 紧凑对话列表整体下边距 */
  listCompact: sharedTokens.spacing.xs,
  /** 列表项下边距 */
  listItem: sharedTokens.spacing.xs,
  listItemCompact: sharedTokens.spacing.xxs,
  /** 分割线垂直外边距 */
  divider: sharedTokens.spacing.md,
  dividerCompact: sharedTokens.spacing.smPlus,
  dividerPreview: sharedTokens.spacing.sm,
  /** 引用块与代码块通用下边距 */
  block: sharedTokens.spacing.sm,
  /** 正文后执行命令/工具链过程区域的顶部额外外边距，加深正文最后一个文字与执行态的层次区隔 */
  processAfterTextMarginTop: sharedTokens.spacing.xsPlus,
  /** 标题外边距阶梯 */
  headings: {
    h1: {
      top: sharedTokens.spacing.md,
      topCompact: sharedTokens.spacing.mdTight,
      bottom: sharedTokens.spacing.sm,
      bottomCompact: sharedTokens.spacing.xsPlus
    },
    h2: {
      top: sharedTokens.spacing.mdSnug,
      topCompact: sharedTokens.spacing.smPlus,
      bottom: sharedTokens.spacing.xsPlus,
      bottomCompact: sharedTokens.spacing.xs
    },
    h3: {
      top: sharedTokens.spacing.mdTight,
      topCompact: sharedTokens.spacing.sm,
      bottom: sharedTokens.spacing.xs,
      bottomCompact: sharedTokens.spacing.xs
    },
    h4: {
      top: sharedTokens.spacing.smPlus,
      topCompact: sharedTokens.spacing.sm,
      bottom: sharedTokens.spacing.xs,
      bottomCompact: sharedTokens.spacing.xs
    },
    h5: {
      top: sharedTokens.spacing.sm,
      topCompact: sharedTokens.spacing.xsPlus,
      bottom: sharedTokens.spacing.xs,
      bottomCompact: sharedTokens.spacing.xs
    },
    h6: {
      top: sharedTokens.spacing.xsPlus,
      topCompact: sharedTokens.spacing.xs,
      bottom: sharedTokens.spacing.xs,
      bottomCompact: sharedTokens.spacing.xxs
    }
  }
} as const

/**
 * 移动端控件（输入框、选择器触发器、操作按钮等）标准几何 Token。
 * 统一移动端表单字段与按钮高度阶梯，避免散落硬编码像素。
 */
export const mobileControlTokens = {
  /** 表单输入框、下拉触发器与操作按钮的标准高度（40px，对齐 HeroUI Button sm 档与移动端标准行高） */
  height: 40,
  /** 紧凑型控件高度（32px） */
  compactHeight: 32,
  /** 大号/主要操作高度（48px） */
  largeHeight: 48,
  /** 单行输入框与选择器默认垂直内边距（8px，配合 20px 行高与 1px 描边正好 38-40px） */
  inputPaddingVertical: sharedTokens.spacing.sm,
  /** 输入框与选择器水平内边距（12px） */
  inputPaddingHorizontal: sharedTokens.spacing.mdTight,
  /** 表单控件标准圆角（10px） */
  radius: sharedTokens.radius.control
} as const
