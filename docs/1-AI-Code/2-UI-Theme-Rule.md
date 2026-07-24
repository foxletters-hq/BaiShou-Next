# UI 主题与布局约定

## 1. 规范概述

BaiShou-Next 桌面 / 移动 UI 使用**同一套语义色与布局口径**。目标是：灰底壳 + 白（或暗色表面）页面层、实色顶栏、共享分段滑块，避免双源 token 与「有的栏白、有的栏毛玻璃」混用。

- **Token SSOT（桌面 CSS）：** [`packages/ui/src/theme/css-variables.css`](../../packages/ui/src/theme/css-variables.css)
- **桌面遗留别名：** [`apps/desktop/src/renderer/src/styles/variables.css`](../../apps/desktop/src/renderer/src/styles/variables.css) 仅作兼容，不得再维护漂移的 `--bg-*` 数值
- **移动：** `useNativeTheme().colors` 字段语义与下表一一对应（`bgApp` / `bgSurface` / `borderMuted` 等）

本轮规范描述的是约定；存量 `--color-surface-*` 可增量消化，**新代码禁止新增** Flutter / Material 平行色名。

## 2. 颜色编码使用限制

为保证深浅模式自动适配，严禁在 `.css`、`.module.css` 及常规内联 `style` 中写入硬编码基色：

- **禁止硬编码基色：** 勿用 `#ffffff`、`#000000`、`white`、`black` 等作为容器、表面、边框或文本颜色。
- **禁止用十六进制兜底：** 勿写 `var(--bg-surface, #FFFFFF)` 或 `rgba(255, 255, 255, 0.85)` 充当主题层。网络/渲染时延下硬兜底会导致闪烁或主题错乱。

> 例外：状态固定且不随主题变化的元素（如特定彩色徽章、错误图标固定红）可保留必要色值。常规表面、字体、按钮必须完全依赖主题变量。

## 3. 语义色

### 3.1 背景（主语义六档）

主层级：**壳 `app` → 页面/顶栏 `surface` → 抬起 `raised`**。其余为交互 / 内凹 / 浮层。

| 用途 | Token | 说明 |
| --- | --- | --- |
| 壳 / 侧栏下画布 / 页面外灰底 | `--bg-app` | 浅色中性灰 |
| 主工作区、**页面顶栏**、列表底 | `--bg-surface` | 浅色实色白；顶栏禁止 glass |
| 卡片 / 下拉 / 抬起块 | `--bg-surface-raised` | 浅色可与 surface 同色，靠边框区分 |
| 悬停 | `--bg-surface-high` | 仅交互态 |
| 内凹次级区 | `--bg-surface-normal` | 分段轨道、灰底分组 |
| 模态 / 最高浮层 | `--bg-surface-highest` | Dialog、Popover |

辅助（存量兼容，新代码尽量不用）：`--bg-surface-low`、`--bg-surface-lowest`、`--bg-surface-highlight`（≈ `high`）。

### 3.2 边框

| 用途 | Token |
| --- | --- |
| 极淡分割 | `--border-subtle` |
| 分割线 / **顶栏底边** | `--border-muted` |
| 灰底上的内容卡片外框 | `--border-card` |
| 可见控件 / 次要按钮描边 | `--border-control`（默认 `1.5px solid`） |
| Focus / 强调描边 | `--border-strong` |

**勿**用 `--border-subtle` 充当按钮或卡片的「看得见」描边（浅色下几乎不可见）。

### 3.3 文本与品牌

| 用途 | Token |
| --- | --- |
| 主标题 / 正文强调 | `--text-primary` |
| 说明 / 次要 | `--text-secondary` |
| 占位 / 禁用 | `--text-tertiary` |
| 主色实心上的字 | `--text-on-primary` |
| 品牌主色 | `--color-primary`（`#5BA8F5`）/ `--color-primary-dark` / `--color-primary-light` |

语义状态色：`--color-success` / `--color-warning` / `--color-error`；勿用 `#2563EB` 等深蓝替代原品牌蓝。

**色系约定：** 品牌蓝统一 `#5BA8F5`。选中项文字 / 图标可用 `--color-primary`；侧栏选中底仍用灰底 `--bg-surface-high`，避免大面积洗蓝。  
**主 CTA：** 纯描边（透明底 + `--border-control` + `--text-primary`），悬停可轻微灰底；勿用深蓝实心。

**字体（桌面 / 移动）：** UI 统一 Noto Sans 体系（`--font-family`）；简中默认 `Noto Sans SC`，`zh-TW`→`Noto Sans TC`，`ja`→`Noto Sans JP`，`en`→`Noto Sans`。代码 / 路径 / Diff 用 `--font-family-mono`。禁止再硬编码 Inter / Manrope / Outfit。  
**字重阶梯：** 正文 `400`；按钮 / Tab / 次要强调 `500`；页面标题 / 卡片标题 / 标签 / Badge `600`。Chrome（顶栏、列表项、chip、设置页）禁止 `700` / `800` / `bold` / `900`；例外仅限品牌名与日记日号等展示型大数字。选中态优先主色 / 灰底，勿靠加粗制造「更粗」。  
**控件阴影：** 描边触发器 / 顶栏 action / chip 默认 `box-shadow: none`；浮层（Modal / Dropdown / Toast）可用 `--shadow-*`；禁止主色 glow 作为常规按钮反馈。

### 3.4 Glass 政策

| 场景 | 政策 |
| --- | --- |
| 页面顶栏、设置/管理子页顶栏、伙伴聊天顶栏、工作台聊天顶栏 | **实色** `--bg-surface`，禁止 glass / `backdrop-filter` |
| 窗口 TitleBar | `--titlebar-glass-bg` 已映射为 `--bg-surface`（实色） |
| 输入条悬浮质感、临时浮层等非页面 chrome | 可使用 `--bg-glass-*`；**新页面 chrome 不得新增 glass** |

### 3.5 双源与遗留别名

| 层级 | 文件 | 规则 |
| --- | --- | --- |
| SSOT | `packages/ui/src/theme/css-variables.css` | 唯一权威数值源 |
| 桌面别名 | `apps/desktop/.../variables.css` | `--color-surface*` / `--color-text*` / `--color-background*` 等仅为遗留别名，映射到 `--bg-*` / `--text-*`；**禁止**在暗色块再重写一套漂移的 `--bg-*` |
| 新代码 | 任意 UI | 只用 `--bg-*` / `--text-*` / `--border-*` / `--color-primary*`（及 success/warning/error） |

移动端 `colors.bgApp` ↔ `--bg-app`，`colors.bgSurface` ↔ `--bg-surface`，`colors.borderMuted` ↔ `--border-muted`，以此类推；勿发明平行色名。

## 4. 布局约定（桌面）

| 区域 | 规则 |
| --- | --- |
| 页面顶栏 | `padding: 12px 32px`；`background: var(--bg-surface)`；`border-bottom: 1px solid var(--border-muted)`；可 `position: sticky; top: 0` |
| 设置 / 管理内容区 | 顶栏下内容间距 `--settings-page-content-gap`（24px）；卡片 `border-radius: 12px`；外框与内嵌分块均用 `border: 1px solid var(--border-card)`；背景 `--bg-surface`（参照 `GeneralSettingsPane` / `SettingsPageChrome`） |
| 表单输入框 / Select 触发器 | 白底 `--form-field-bg`（=`--bg-surface`）+ 描边 `--form-field-border`（=`--border-control`）；禁止用 `--bg-surface-low` / `--bg-surface-normal` 作输入底；`:focus` / `:focus-within` 保持中性描边、`box-shadow: none`，禁止主色描边或蓝色外圈 glow |
| 分段滑块 | 只用 [`packages/ui/src/desktop/shared/SegmentedControl.module.css`](../../packages/ui/src/desktop/shared/SegmentedControl.module.css) 的 `group` / `btn` / `btnActive`；选中为白底抬起 + 文字 `--color-primary`，禁止实心主色块与蓝色 glow |
| 原生滑动条 | 统一 `theme/range-slider.css`（3px 轨道 + 14px 圆拇指 + `--color-primary`）；勿在组件内再写一套 thumb/track；进度可用 `style.backgroundSize` |
| 主按钮 | 纯描边：透明底 + `--border-control`；悬停可 `--bg-surface-high`；勿用深蓝实心 |
| 次要按钮 | `border: 1.5px solid var(--border-control)`，文字 `--text-primary` |
| 顶栏 / 侧栏选中 | 灰底 `--bg-surface-high` + 文字/图标 `--color-primary`，不用主色实心底 |

## 5. 动效与视觉风格

1. **动画：** 页面级转场交给 `MainLayout`；组件内交互动效宜 ≤ `0.2s`（可用 `--duration-fast` / `--ease-out-cubic`）。
2. **实色为主：** 主要互动控件用单系统色 `--color-primary`；禁止常规 CTA 使用多色 `linear-gradient` 或夸张 `transform` 高亮。
3. **反馈：** 优先阴影 token（`--shadow-sm` 等）或 `opacity`，保持克制。

## 6. 允许的例外（不必强行语义化）

| 例外 | 说明 |
| --- | --- |
| `box-shadow` / elevation 的 `rgba(0,0,0,…)` | 阴影通道，可用 |
| 图表系列色、热力图等级色、Provider 品牌色 | 数据/品牌意图色 |
| 危险 / 成功 | 必须用 `--color-error` / `--color-success`（及 `--color-error-rgb`）；勿写 `#ef4444` |
| `mix-blend-mode: difference` 上的反色字 | 叠在自定义聊天背景上的可读性技巧 |
| `--color-surface*` 别名定义本身 | 仅允许存在于桌面 `variables.css` 兼容层 |

主色按钮上的文字用 `--text-on-primary`，勿写 `color: #fff`。

## 7. 质量校验清单

提交 UI 相关改动前自检：

- [ ] 无未语义化十六进制基色（`#fff`、`#f8f9fa` 等）用于表面 / 文本 / 边框（§6 例外除外）
- [ ] 页面顶栏为 `--bg-surface` + `--border-muted`，未使用 glass
- [ ] 分段滑块复用 `SegmentedControl.module.css`，未本地复制
- [ ] 新代码未新增 `--color-surface-*` / `--color-background-*` / `--color-on-surface*`
- [ ] 未在组件内用 `[data-theme='dark']` 硬编一套平行色（应走全局变量）
- [ ] 主色实心按钮文字为 `--text-on-primary`

_—— 适用于桌面与移动前端组件渲染行为。_
