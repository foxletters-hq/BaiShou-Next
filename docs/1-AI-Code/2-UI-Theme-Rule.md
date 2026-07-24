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

### 3.6 设置页字号 / 字重（桌面 SSOT）

设置 UI 以**侧栏 + 常规设置**为视觉基准。新设置页 / 改样式时**必须**使用下列 token，禁止再写散落的 `16px` / `20px` / `0.95rem` 平行字号。

| 角色 | CSS Token（size / weight） | 数值 | 用途 |
| --- | --- | --- | --- |
| 壳标题 | `--settings-font-shell-title-*` | **22 / 600** | 侧栏「系统设置」 |
| 页标题 | `--settings-font-page-title-*` | **18 / 600** | `SettingsPageChrome` 顶栏标题；勿自建 20px 顶栏 |
| 区块标题 | `--settings-font-section-*` | **15 / 600** | 卡内 section / cardTitle |
| 侧栏导航 | `--settings-font-nav-*` | **14 / 500** | `.settings-nav-label` |
| 列表行 | `--settings-font-row-*` | **14 / 400** | `SettingsListTile` 行标题、设置行正文 |
| 表单标签 | `--settings-font-label-*` | **13 / 500** | 字段 label、chip 文案 |
| 说明文案 | `--settings-font-desc-*` | **13 / 400** | 行 subtitle / 次要说明（色用 `--text-secondary`） |
| 元信息 | `--settings-font-meta-*` | **12 / 500** | 侧栏分组 label、hint、路径角标 |
| 微文案 | `--settings-font-micro-*` | **11 / 600** | badge 等极次要（少用） |

**JS / 移动：** 同阶梯见 [`packages/ui/src/theme/tokens.ts`](../../packages/ui/src/theme/tokens.ts) 的 `settingsTypography` / `settingsIcons`。

| 图标角色 | CSS Token | 数值 | 用途 |
| --- | --- | --- | --- |
| 行左侧 | `--settings-icon-leading-size` | **20px** | `SettingsListTile` leading Lucide |
| 行右侧 | `--settings-icon-trailing-size` | **18px** | 箭头 / 外链等 trailing |
| 左侧占位 | `--settings-icon-leading-slot` | **32px** | leading 列宽 |

**原则：**

1. 设置 UI 字号一律 **px**，勿用 `rem`。
2. 字重只用 **400 / 500 / 600**；选中态靠主色 / 灰底，不加粗。
3. 页标题统一走 `SettingsPageChrome`（18/600）；WebSearch / TTS 等勿再平行写 20px 顶栏。
4. 交互行统一 ListTile 节奏：**14/400 + 13 说明**；行图标 **20 / 18**，勿再写 24dp。
5. 灰底上只铺一层内容卡（`--border-card`）；**禁止大卡套小卡**（内层再起白底+描边）。
6. About 营销区、品牌名等展示型文案可例外，但普通设置行仍跟本表。

### 3.7 设置页分割层级

**大分割靠「卡片缝 + 卡外标题」，小分割才靠线。** 线只服务「同一张卡里的相邻行」，勿用同款水平线既切板块又切行。

| 层级 | 手段 | 规则 |
| --- | --- | --- |
| 大板块（Section） | 卡外 `sectionLabel` + sibling `cardSection` + 卡片间距 | 标题用 `--settings-font-meta-*`（12/500）+ **`--text-primary`**；标题下**紧接卡片**，勿在卡外再写说明段落；需要说明时用标题旁 `HelpTooltip`（?）；**卡与卡之间不画水平分割线** |
| 行（Row） | 卡内 `divider` / `settings-list-divider` | 仅 `--border-muted` 或 `--border-subtle` 的 1px hairline |
| Chrome | 顶栏 / 页签栏底边 | 保留，不算内容区板块分割 |

结构样板（见 `GeneralSettingsPane`）：

```text
stackGroup
  sectionLabelRow（卡外：标题 + 可选 HelpTooltip）
  cardSection（白卡）
    cardBody → 行 / ListTile；行间用 divider
```

**收敛：** 勿在单层大卡里用 `pageSection` 底边或全宽 divider「冒充下一板块」；应拆成多张 sibling 卡。卡内子分组（如「可信目录」）可用更轻的 meta 文案，不要再起一层白底描边卡。

## 4. 布局约定（桌面）

| 区域 | 规则 |
| --- | --- |
| 页面顶栏 | `padding: 12px 32px`；`background: var(--bg-surface)`；`border-bottom: 1px solid var(--border-muted)`；可 `position: sticky; top: 0` |
| 设置 / 管理内容区 | 顶栏下内容间距 `--settings-page-content-gap`（24px）；卡片 `border-radius: 12px`；外框用 `border: 1px solid var(--border-card)`；背景 `--bg-surface`（参照 `GeneralSettingsPane` / `SettingsPageChrome`）；**禁止大卡套小卡**；板块分割见 §3.7（卡外标题 + 卡片间距，卡内细线）；**设置白卡禁止 `overflow: hidden`**（会裁切绝对定位的 Select / Combobox 下拉） |
| 表单输入框 / Select 触发器 | 白底 `--form-field-bg`（=`--bg-surface`）+ 描边 `--form-field-border`（=`--border-control`）；禁止用 `--bg-surface-low` / `--bg-surface-normal` 作输入底；`:focus` / `:focus-within` 保持中性描边、`box-shadow: none`，禁止主色描边或蓝色外圈 glow |
| 分段滑块 | 只用 [`SegmentedControl`](../../packages/ui/src/desktop/shared/SegmentedControl.tsx)（`packages/ui` 导出）；选中为白底指示器**滑动**切换 + 文字 `--color-primary`，禁止实心主色块与蓝色 glow；勿再手写 `group` / `btn` / `btnActive` 拼装 |
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
- [ ] 分段滑块复用 `SegmentedControl` 组件（滑动指示器），未本地复制样式或手写 `btnActive` 拼装
- [ ] 新代码未新增 `--color-surface-*` / `--color-background-*` / `--color-on-surface*`
- [ ] 未在组件内用 `[data-theme='dark']` 硬编一套平行色（应走全局变量）
- [ ] 主色实心按钮文字为 `--text-on-primary`
- [ ] 设置页字号/字重使用 `--settings-font-*` 或 `settingsTypography`，无散落 16/20px 或 rem 平行字号（§3.6）
- [ ] 设置行图标使用 `--settings-icon-*` / `settingsIcons`（leading 20 / trailing 18），无大卡套小卡
- [ ] 设置页分割：大板块用卡外标题 + sibling 卡间距；卡内才用细线（§3.7），无「全页同款水平线」切板块

_—— 适用于桌面与移动前端组件渲染行为。_
