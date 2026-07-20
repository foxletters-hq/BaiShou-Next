# 桌面端伙伴侧栏「折叠不卡顿」做法

> **背景**：伙伴页曾有一条独立侧栏（伙伴卡片 + 新对话 + 会话列表）。折叠/展开时如果直接改宽度并让内部内容跟着 reflow，容易出现文字挤压、列表抖动、观感发涩。
>
> **结果**：用「外层只动宽度 + 内层定宽淡出」的双层结构，折叠动画可以做到比较顺滑。本文记录做法与取舍，便于其它侧栏复用。
>
> **代码位置**（写法仍在仓库中）：
>
> - [`AgentSidebar.tsx`](../../../apps/desktop/src/renderer/src/features/agent/components/AgentSidebar.tsx)
> - [`AgentSidebar.module.css`](../../../apps/desktop/src/renderer/src/features/agent/components/AgentSidebar.module.css)

---

## 1. 问题：为什么「只改 width」会不流畅

常见写法：

```css
.sidebar {
  width: 280px;
  transition: width 0.3s ease;
}
.sidebar.collapsed {
  width: 0;
}
```

侧栏内部若是「自适应宽度」的 flex 布局，折叠时会发生：

1. **内容跟着挤**：标签从完整文案被压成省略号，再消失，视觉上在「扭」。
2. **列表 reflow**：会话行宽度每帧变化，滚动条、省略号、拖拽手柄一起抖。
3. **布局抖动传递到主区**：聊天区 `flex: 1` 同步扩张，和侧栏抢同一帧的布局计算。

用户体感往往不是「慢」，而是「脏」——过渡过程中信息密度在乱跳。

---

## 2. 核心思路：双层壳

把「占位宽度」和「内容画布」拆开：

```mermaid
flowchart LR
  Outer["外层 .sidebar<br/>只负责 width 0↔280"]
  Inner["内层 .sidebarInner<br/>始终 280px 定宽"]
  Outer --> Inner
  Inner --> Content["伙伴卡片 / 会话列表 / …"]
```

| 层 | 职责 | 动画 |
|----|------|------|
| **外层** | 决定侧栏在文档流里占多少空间 | `width`：`280px` → `0` |
| **内层** | 内容始终按完整宽度排版 | `opacity` + `filter: blur`，**不改自己的 width** |

折叠时：外层像百叶窗一样收窄，内层像一张固定尺寸的画布淡出并轻微模糊——内容形态不变，只是被「裁切 + 淡出」。

---

## 3. 关键 CSS

摘自 `AgentSidebar.module.css`（略有注释）：

```css
.sidebar {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden; /* 内层定宽时，靠外层裁切 */
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.collapsed {
  width: 0;
  min-width: 0;
  border-right: none;
  overflow: hidden;
  pointer-events: none; /* 收起后不可点到「看不见」的按钮 */
}

.sidebarInner {
  width: 280px;
  min-width: 280px; /* 关键：禁止被外层压窄 */
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.collapsed .sidebarInner {
  opacity: 0;
  filter: blur(8px);
}
```

组件侧只是挂 class：

```tsx
<div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
  <div className={styles.sidebarInner}>{/* 全部侧栏内容 */}</div>
</div>
```

---

## 4. 几个容易忽略的细节

### 4.1 `overflow: hidden` 必须在外层

内层定宽 280px、外层收成 0 时，没有裁切就会溢出盖住聊天区。裁切发生在外层，内层才能「假装自己一直很宽」。

### 4.2 `min-width: 280px` 与 `flex-shrink: 0`

父级是 flex 时，子项默认可能被压窄。内层必须钉死宽度，否则又退化成「内容跟着挤」。

### 4.3 `pointer-events: none`

折叠后外层宽度为 0，但动画过程中或个别浏览器下，透明内容仍可能接到点击。收起态关掉指针事件更稳。

### 4.4 缓动曲线

使用 Material 系常用的 `cubic-bezier(0.4, 0, 0.2, 1)`（ease-out 感），比线性或默认 `ease` 更接近「推拉面板」的手感。时长约 `0.3s`：再短会硬，再长会拖。

### 4.5 `blur` 是锦上添花

`filter: blur(8px)` 让淡出带一点景深，折叠时不那么像「突然蒸发」。注意：

- 模糊有合成层成本，侧栏内容很重时要实测；
- 不需要炫技时，只做 `opacity` 也足够流畅。

### 4.6 主区不要抢动画

聊天区用 `flex: 1; min-width: 0` 跟随外层宽度变化即可，**不要**再给主区单独做一套对称的 width 动画，避免双边抢布局。

---

## 5. 和「display: none / 卸载」的对比

| 做法 | 优点 | 缺点 |
|------|------|------|
| 直接 `display: none` | 实现简单 | 无过渡，或只能硬切 |
| 卸载侧栏组件 | 省内存 | 滚动位置、搜索框状态易丢；难做过渡 |
| **双层 width + 淡出** | 过渡顺、内容形态稳定 | 折叠后 DOM 仍在（可用 `content-visibility` 等再优化） |

伙伴侧栏会话列表带滚动位置与多选状态时，保留 DOM、只做视觉折叠通常更合适。

---

## 6. 适用边界

**适合**

- 固定宽度的导航 / 会话侧栏
- 折叠时仍希望保留内部状态
- 希望主区平滑让出空间

**不太适合**

- 侧栏宽度本身可拖拽（拖拽过程需要实时 reflow，双层定宽会打架）
- 折叠目标不是 `0`，而是「窄图标轨」（应做两套布局切换，而不是单纯 width→0）

窄轨方案可以仍用双层思路：外层 `280 → 60`，内层在展开态显示完整内容、收起态换成图标轨组件，而不是把 280 内容硬挤进 60。

---

## 7. 产品演进备注

伙伴页 IA 后续改为「顶栏伙伴卡片 + 会话弹层」，主路径不再依赖这条可折叠侧栏。  
**双层折叠写法仍留在 `AgentSidebar` 中**，日记侧栏、工作台 SidePane、其它抽屉若需要「收得干净」，可以直接复用同一模式。

---

## 8. 一句话总结

> **外层只动画占位宽度，内层永远按完整宽度排版，再用裁切 + 透明度（可选模糊）收掉。**  
> 流畅来自「过渡期不让文字和列表变形」，而不是把动画时长拉长。

[返回桌面端目录](./0-README.md) · [返回技术分享](../0-README.md)
