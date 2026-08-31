# 统一记忆中心实施计划

> **状态**：已落地，待对照验收
> **范围**：桌面端 `apps/desktop/src/renderer`，纯函数与文案 `packages/shared`
> **数据影响**：无。不改表结构、不迁移数据、不改同步协议、不改抽取与嵌入逻辑
> **本计划只做界面收拢与状态呈现**，不改变任何记忆写入行为

---

## 1. 要解决的问题

记忆能力当前散在四个位置，用户需要跨页面才能让其中一个页面跑起来。

用户在 `/graph` 点「开始整理」，若嵌入模型未配置或日记未向量化，得到的提示是：

```
请先配置嵌入模型，并完成本篇日记的向量化后再抽取
```

这一句指向两个动作：配置嵌入模型在 `/hub/ai-models`，把日记向量化在 `/hub/rag`。这两个页面默认都不在侧边栏上（`rag` 属于 `getDefaultHiddenNavIds()` 返回的隐藏项）。用户拿到提示后无法就地解决。

**目标**：把日记与伙伴共用的全局记忆收进一个侧边栏入口，并在同一屏内显示「缺什么、去哪补」。

---

## 2. 已锁定的决策

| 项         | 决定                                                         |
| ---------- | ------------------------------------------------------------ |
| 侧边栏入口 | 用「记忆」替换现有「人生关系图」，路由 `/memory`             |
| 内部结构   | 两个标签页：向量片段、关系图谱                               |
| 默认标签页 | 关系图谱（与替换前的一级入口落点一致，老用户零迁移）         |
| 笔记本记忆 | 不并入。向量与关系图仍在各自笔记本内，入口保持工作台         |
| 就绪状态   | 两个标签页共用一条顶部状态，四行                             |
| 命名       | 「向量片段」「关系图谱」；关系图谱内部保留标题「人生关系图」 |

### 记忆的两种形态与两个范围

**全局 AI 记忆**：日记与伙伴共用，按工作空间隔离，两者互相可见、实体会合并。

- 向量片段 → `memory_embeddings`（日记正文 `source_type = diary`，伙伴写入 `source_type = memory`）
- 关系图谱 → `graph_nodes` / `graph_edges` / `graph_node_aliases`

**笔记本记忆**：每本笔记独立，节点 ID 的盐含 `notebookId`，跨笔记本同名不合并，也不与全局记忆合并。

- 向量 → `knowledge_chunks`
- 关系图 → `notebook_graph_nodes` / `notebook_graph_edges`

伙伴对话时可以读取笔记本记忆（`knowledge_search`、`knowledge_graph_search` 均为只读），但只往全局记忆写入。笔记本的向量与关系图仅由资料抽取写入。

---

## 3. 明确不做

以下为已锁定的产品与架构决策，后续复查不得再当作缺口。

1. **不合并两套图**。全局关系图与笔记本关系图保持隔离，跨库同名实体不合并。
2. **不把笔记本的向量与关系图搬进记忆中心**。记忆中心只显示一句说明，指明它们在各自笔记本内。
3. **不改动嵌入门槛**。关系抽取仍要求嵌入模型已配置且该篇日记已向量化，报错码 `GRAPH_EXTRACT_EMBEDDING_REQUIRED` 与 `GRAPH_EXTRACT_DIARY_NOT_EMBEDDED` 保持不变。
4. **不给笔记本图节点加向量**，因此笔记本跨资料的同人异名仍不会自动合并。
5. **不改移动端**。本计划只覆盖桌面端；移动端沿用现有 `GraphScreen` 与设置枢纽 `rag` 项。
6. **不动 `PERSISTENT_MAIN_PAGE_KEYS`**。`/memory` 离开即卸载，与替换前的 `/graph` 行为一致。

---

## 4. 命名与文案约定

侧边栏项：**记忆**，图标 `Brain`（`lucide-react`）。

页面标题：**全局 AI 记忆**。标题下固定一句说明：

> 日记和伙伴共用这一套记忆。片段保存原文，用于回忆细节；关系保存联系，用于理清脉络。笔记本资料的向量和关系图在各自笔记本里管理，不并入这里。

标签页名称：**向量片段** / **关系图谱**。

就绪状态四行文案：

| 行  | 标签     | 就绪时                | 缺失时                                    |
| --- | -------- | --------------------- | ----------------------------------------- |
| 1   | 嵌入模型 | 模型名                | 未配置，按钮「去配置」跳 `/hub/ai-models` |
| 2   | 关系抽取 | 跟随对话模型 + 模型名 | 未配置对话模型                            |
| 3   | 向量片段 | 已全部索引            | 未索引 N 篇，按钮「开始索引」             |
| 4   | 关系图谱 | 已全部整理            | 待整理 N 篇，按钮「开始整理」             |

嵌入模型未配置时，第 3、4 行标注「需要先配置嵌入模型」并禁用按钮。

---

## 5. 现状盘点

| 对象         | 当前位置                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| 关系图谱页面 | `features/graph/GraphPage.tsx`，路由 `/graph`                               |
| 向量片段页面 | `features/settings/components/RagSettingsPane.tsx`，路由 `/hub/rag`         |
| 侧边栏目录   | `components/Sidebar/sidebar-nav-catalog.tsx`                                |
| 路由声明     | `App.tsx`，`/graph` 为 `CachedRoutePlaceholder`                             |
| 保活映射     | `layouts/MainPageCache.tsx`，`MAIN_PAGE_CACHE['/graph']`                    |
| 日记底栏跳转 | `features/diary/DiaryPage.tsx`，跳 `/graph` 与 `${SETTINGS_HUB_PREFIX}/rag` |
| 就绪数据来源 | 同上，`DiaryPage.refreshStatusBar` 已在调用所需全部接口                     |

`DiaryPage.refreshStatusBar` 已经并行读取四项数据，就绪状态条可以复用同一组接口，**无需新增主进程代码或 IPC**：

- `window.api.graph.listPendingReextract()`
- `window.api.rag.getUnindexedDiaryCount()`
- `window.api.settings.getGlobalModels()`
- `window.api.settings.getRagConfig()`

`rag` 段落所需的配置键为 `['ragConfig', 'globalModels']`。在设置外壳之外挂载向量片段面板时，必须自行调用 `ensureConfigForSegment('rag')`，否则面板会拿到空配置。`features/agent-workspace/workbench/skills/WorkbenchSkillsPage.tsx` 已有在设置外壳之外使用 `useSettingsPaneApi()` 的先例，可参照。

---

## 6. 阶段划分

### 阶段一：就绪状态条（不动路由）

先只做状态条，同时插进现有 `/graph` 与 `/hub/rag` 两个页面。这一步改动最小，独立可验收，即使后续阶段延后也已解决「缺什么、去哪补」。

**新增**

| 操作 | 路径                                                                          |
| ---- | ----------------------------------------------------------------------------- |
| 新增 | `packages/shared/src/utils/memory-readiness.util.ts`                          |
| 新增 | `packages/shared/src/utils/__tests__/memory-readiness.util.test.ts`           |
| 新增 | `apps/desktop/src/renderer/src/features/memory/MemoryReadinessBar.tsx`        |
| 新增 | `apps/desktop/src/renderer/src/features/memory/MemoryReadinessBar.module.css` |
| 新增 | `apps/desktop/src/renderer/src/features/memory/useMemoryReadiness.ts`         |
| 修改 | `features/graph/GraphPage.tsx`（在工具栏下方挂入状态条）                      |
| 修改 | `features/settings/components/RagSettingsPane.tsx`（在面板顶部挂入状态条）    |
| 修改 | `packages/shared/src/utils/index.ts` 或对应桶文件（导出新 util）              |

**纯函数契约**

```ts
export type MemoryReadinessRowId = 'embedding' | 'extract' | 'vector' | 'graph'
export type MemoryReadinessState = 'ready' | 'missing' | 'blocked' | 'pending'

export type MemoryReadinessInput = {
  globalModels: Partial<GlobalModelsConfig> | null
  ragConfig: Pick<RagConfig, 'ragEnabled'> | null
  unindexedDiaryCount: number
  pendingGraphCount: number
}

export type MemoryReadinessRow = {
  id: MemoryReadinessRowId
  state: MemoryReadinessState
  /** 就绪时为模型名或空字符串；待办时为数量 */
  count?: number
  modelId?: string
}

export function buildMemoryReadinessRows(input: MemoryReadinessInput): MemoryReadinessRow[]
```

**可核验断言**

| 编号 | 断言                                                                               | 期望位置                   |
| ---- | ---------------------------------------------------------------------------------- | -------------------------- |
| A1   | `buildMemoryReadinessRows` 固定返回 4 行，顺序为 embedding、extract、vector、graph | `memory-readiness.util.ts` |
| A2   | 嵌入模型缺失时，embedding 行为 `missing`，vector 与 graph 行均为 `blocked`         | 同上                       |
| A3   | 嵌入模型已配置且待办数为 0 时，对应行为 `ready`；待办数大于 0 时为 `pending`       | 同上                       |
| A4   | `ragEnabled === false` 时 vector 行为 `blocked`，graph 行仍按嵌入模型判定          | 同上                       |
| A5   | extract 行的 `modelId` 取自 `resolveGlobalGraphModelIds(globalModels).modelId`     | 同上                       |
| A6   | `GraphPage` 与 `RagSettingsPane` 均引用 `MemoryReadinessBar`                       | 两文件各一处 import        |

**测试**：`pnpm --filter @baishou/shared test -- memory-readiness.util.test.ts`，覆盖 A1 至 A5 各一条用例。A6 用源码断言测试覆盖（参照 `features/graph/__tests__/graph-page-chrome.test.ts` 的读源码方式）。

**验收**

- [ ] 未配置嵌入模型时，两个页面顶部都显示「嵌入模型 未配置」并可点击跳转
- [ ] 已配置且有待办时，第 3、4 行显示数量且按钮可用
- [ ] 全部就绪时四行都显示就绪，不显示按钮
- [ ] `pnpm --filter @baishou/shared test` 全绿

---

### 阶段二：记忆中心外壳与路由替换

**新增**

| 操作 | 路径                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 新增 | `features/memory/MemoryCenterPage.tsx`                                                                |
| 新增 | `features/memory/MemoryCenterPage.module.css`                                                         |
| 新增 | `features/memory/memory-center-tab.util.ts`                                                           |
| 新增 | `features/memory/__tests__/memory-center-tab.util.test.ts`                                            |
| 新增 | `features/memory/MemoryVectorTab.tsx`（包装 `RagSettingsPane`，自行 `ensureConfigForSegment('rag')`） |

**修改**

| 路径                                         | 改动                                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layouts/MainPageCache.tsx`                  | `MAIN_PAGE_CACHE` 增加 `/memory` 键，懒加载 `MemoryCenterPage`；`getMainPageCacheKey` 对 `/memory` 前缀返回 `/memory`                                                                              |
| `App.tsx`                                    | 增加 `/memory/*` 占位路由；`/graph` 改为重定向到 `/memory/graph`；`/hub/rag` 保留并重定向到 `/memory/vectors`                                                                                      |
| `components/Sidebar/sidebar-nav-catalog.tsx` | `graph` 项改为 `memory`：label「记忆」、path `/memory`、图标 `Brain`；同步改 `ALL_SIDEBAR_NAV_IDS`、`DEFAULT_VISIBLE_NAV_IDS`、`SIDEBAR_NAV_PATHS`、`SIDEBAR_NAV_GROUPS`；从「伙伴」分组移除 `rag` |
| `components/Sidebar/sidebar-preferences.ts`  | 旧偏好中的 `graph` / `rag` 迁移为 `memory`，避免升级后侧栏丢项                                                                                                                                     |
| `features/diary/DiaryPage.tsx`               | 两个跳转改为 `/memory/vectors` 与 `/memory/graph`                                                                                                                                                  |
| `features/settings/SettingsContentView.tsx`  | `case 'rag'` 改为重定向提示或直接移除该段落                                                                                                                                                        |

**标签页路由**

- `/memory` → 重定向 `/memory/graph`
- `/memory/graph` → 关系图谱
- `/memory/vectors` → 向量片段

标签页切换使用 `SegmentedControl`（`packages/ui` 导出），不手写按钮组。顶栏样式遵循 `padding: 12px 32px`、`background: var(--bg-surface)`、`border-bottom: 1px solid var(--border-muted)`。

**可核验断言**

| 编号 | 断言                                                                                                                              | 期望位置                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| B1   | `memoryCenterTabFromPath` 对 `/memory`、`/memory/graph` 返回 `graph`，对 `/memory/vectors` 返回 `vectors`，对未知段落回退 `graph` | `memory-center-tab.util.ts` |
| B2   | `MAIN_PAGE_CACHE` 含 `/memory` 键，`getMainPageCacheKey('/memory/vectors')` 返回 `/memory`                                        | `MainPageCache.tsx`         |
| B3   | `/graph` 与 `/hub/rag` 均可访问且重定向到对应标签页，不出现空白页                                                                 | `App.tsx`                   |
| B4   | `sidebar-nav-catalog` 中不再存在 `graph` 与 `rag` 两个 id，存在 `memory` 且在 `DEFAULT_VISIBLE_NAV_IDS` 内                        | `sidebar-nav-catalog.tsx`   |
| B5   | 升级用户旧侧栏偏好含 `graph` 时，迁移后可见项含 `memory`                                                                          | `sidebar-preferences.ts`    |
| B6   | `MemoryVectorTab` 挂载时调用 `ensureConfigForSegment('rag')`                                                                      | `MemoryVectorTab.tsx`       |
| B7   | 标签页切换器使用 `SegmentedControl`，源码中不出现手写 `btnActive` 类名                                                            | `MemoryCenterPage.tsx`      |
| B8   | `DiaryPage` 底栏两个跳转目标为 `/memory/vectors` 与 `/memory/graph`                                                               | `DiaryPage.tsx`             |

**测试**

- `pnpm --filter @baishou/desktop test -- memory-center-tab.util.test.ts`（B1）
- 新增源码断言测试覆盖 B2、B4、B7、B8
- B3、B5、B6 需手工验收并记录

**验收**

- [ ] 侧边栏显示「记忆」，点击进入默认落在关系图谱
- [ ] 两个标签页切换后画布状态与滚动位置符合预期（离开 `/memory` 后卸载，重进重建）
- [ ] 从日记底栏点「待嵌入」直接落在向量片段标签页
- [ ] 旧路由 `/graph` 与 `/hub/rag` 仍可访问
- [ ] 升级用户侧栏不丢项
- [ ] `pnpm ci:check` 全绿

---

### 阶段三：首次引导与笔记本说明

**新增**

| 操作 | 路径                                       |
| ---- | ------------------------------------------ |
| 新增 | `features/memory/MemoryOnboardingCard.tsx` |
| 新增 | `features/memory/MemoryNotebookNotice.tsx` |

**内容**

首次进入且嵌入模型未配置时，在就绪状态条下方显示三步引导：

1. 配置嵌入模型 → 跳 `/hub/ai-models`
2. 建立向量片段 → 切到向量片段标签页并高亮「全量扫描未索引日记」
3. 整理关系图谱 → 切到关系图谱标签页并高亮「开始整理」

三步全部完成后不再显示，状态记在 `localStorage`，键名 `baishou.memory.onboardingDismissed.v1`。

笔记本说明放在页面标题下方，常驻一行，附跳转按钮到 `/agent-workspace/knowledge`。

**可核验断言**

| 编号 | 断言                                            | 期望位置                   |
| ---- | ----------------------------------------------- | -------------------------- |
| C1   | 嵌入模型已配置且两项待办均为 0 时，引导卡不渲染 | `MemoryOnboardingCard.tsx` |
| C2   | 引导卡关闭状态持久化到 `localStorage`，键名固定 | 同上                       |
| C3   | 笔记本说明常驻显示，不受引导卡关闭影响          | `MemoryNotebookNotice.tsx` |
| C4   | 说明文案明确指出笔记本记忆不并入全局记忆        | 中文文案与 `zh.i18n.json`  |

**验收**

- [ ] 全新安装首次进入显示三步引导
- [ ] 配置完成后引导消失
- [ ] 笔记本说明始终可见且可跳转

---

## 7. 必须守住的不变量

| 不变量           | 说明                                             |
| ---------------- | ------------------------------------------------ |
| 记忆写入行为不变 | 本计划不改抽取、嵌入、对齐、合并任何逻辑         |
| 两套库隔离       | 全局记忆与笔记本记忆不互通，不合并实体           |
| 嵌入门槛不变     | 关系抽取仍要求嵌入模型已配置且该篇已向量化       |
| 旧路由可达       | `/graph` 与 `/hub/rag` 保留为重定向，不返回空白  |
| 侧栏偏好不丢     | 升级用户的旧 `graph` / `rag` 偏好迁移为 `memory` |
| 无数据迁移       | 不改表结构、不写迁移脚本、不改同步协议           |

---

## 8. 风险与回滚

| 风险                                                                                                                                 | 缓解                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `graph-page-chrome.test.ts` 读取 `GraphPage.tsx` 源码切片断言，插入状态条可能影响 `styles.toolbar` 到 `styles.sideColumn` 之间的内容 | 状态条挂在该切片之外，或同步更新该测试；不移动 `t('graph.title'` 的位置                                     |
| 向量片段面板脱离设置外壳后拿到空配置                                                                                                 | `MemoryVectorTab` 自行 `ensureConfigForSegment('rag')`，并在加载中显示占位                                  |
| 侧栏 id 改名导致升级用户丢项                                                                                                         | `sidebar-preferences` 加一次性迁移，断言 B5 覆盖                                                            |
| 关系图画布在标签页隐藏时仍在跑力导向计算                                                                                             | 标签页非激活时不渲染对应子树，或复用 `MainPageCacheActiveContext` 的激活标志                                |
| 两个页面同时挂状态条导致重复请求                                                                                                     | `useMemoryReadiness` 内做请求合并与可见性节流，参照 `DiaryPage.refreshStatusBar` 的 `visibilitychange` 处理 |

**回滚**：阶段一独立，回滚只需摘掉两处 `MemoryReadinessBar` 引用。阶段二回滚需恢复 `sidebar-nav-catalog` 的 `graph` / `rag` 两项、`MainPageCache` 的 `/graph` 键与 `App.tsx` 路由。三个阶段均无数据回滚。

---

## 9. 完成定义

- [ ] 侧边栏只有一个「记忆」入口，内含两个标签页
- [ ] 就绪状态条在两个标签页共用，四行状态与实际配置一致
- [ ] 嵌入模型未配置时，两项待办按钮禁用并说明原因
- [ ] 笔记本记忆的位置在页面上有明确说明
- [ ] 旧路由 `/graph` 与 `/hub/rag` 可达
- [ ] 升级用户侧栏不丢项
- [ ] `pnpm ci:check` 全绿

---

## 10. 提交建议（中文）

阶段一至三分开提交，每阶段不超过 10 个文件。

1. `feat(memory): 新增记忆就绪状态条并接入关系图与记忆管理两页`
2. `refactor(memory): 侧栏收拢为「记忆」入口，关系图谱与向量片段改为标签页`
3. `feat(memory): 记忆中心首次引导与笔记本记忆位置说明`

---

## 11. 落地状态

阶段一

- [x] `memory-readiness.util.ts` 与测试
- [x] `MemoryReadinessBar` 组件
- [x] 接入 `GraphPage`
- [x] 接入 `RagSettingsPane`

阶段二

- [x] `MemoryCenterPage` 外壳与标签路由
- [x] `MainPageCache` 与 `App.tsx` 路由改造
- [x] 侧栏目录与偏好迁移
- [x] `DiaryPage` 跳转改向
- [x] 旧路由重定向

阶段三

- [x] 三步引导卡
- [x] 笔记本记忆说明
