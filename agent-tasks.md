# Agent 任务分配计划

> 基于 todo.md 的 33 个任务，按功能模块和工作量分配给 9 个 Agent

---

## Agent 1: 日记与筛选功能

**负责任务:** 2, 3, 20

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 2 | 日记页面点击筛选后变成全屏灰色遮罩，无法正确点击筛选属性，修复后检查筛选功能 | 高 |
| 3 | 写日记保存后返回日记页面，应保持筛选、月份选择状态 | 高 |
| 20 | 日记预览时，无论选择月份还是年份都应有分页，少于50条不显示分页，大于50条显示分页组件（50、80、100、200） | 中 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/diary/`
- `packages/ui/src/web/DiaryCard/`
- `packages/database/src/repositories/diary.repository.ts`

---

## Agent 2: 伙伴管理 UI 优化

**负责任务:** 4, 5, 6, 7, 8, 23, 24

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 4 | 伙伴管理页面，点击新增伙伴时切换页面应有动画（和切换选项页面动画一致） | 中 |
| 5 | 伙伴编辑页面，点击头像选择框后已有图片选择器，不需要显示"长按选择图片"提示 | 低 |
| 6 | 伙伴编辑选择图片头像后，应像用户更换头像一样显示编辑器 | 中 |
| 7 | 伙伴编辑页面选择默认模型后，模型显示应为供应商icon+模型名称（像模型选择器效果），现在显示✨ | 高 |
| 8 | 伙伴默认模型提示文案改为"绑定后，和伙伴创建对话时，会默认优先使用选择的模型"，同步i18n | 中 |
| 23 | 伙伴聊天页面，选择置顶伙伴头像时不需要缩小，微微亮起表示选中即可 | 低 |
| 24 | 伙伴聊天页面，选中指定伙伴后点击新会话，应正确在选中伙伴下发起新会话（现在变回原伙伴） | 高 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/agent/`
- `packages/ui/src/web/AssistantPicker/`
- `packages/store/src/stores/assistant.store.ts`

---

## Agent 3: RAG 记忆管理

**负责任务:** 10, 11, 12, 13, 14, 15, 16

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 10 | RAG记忆管理页面灰色背景未铺满整个页面，滚动后有灰白拼接 | 中 |
| 11 | RAG记忆管理页面记忆显示应做分页，默认10条一页，可选20、30、50、100 | 高 |
| 12 | RAG记忆管理页面关闭RAG记忆时提示语改为"RAG记忆功能已经关闭了喵~"，同步i18n | 低 |
| 13 | RAG记忆管理页面删除"清空当前维度记忆"按钮，把"清空所有向量数据"按钮文字改成"清空现有记忆" | 中 |
| 14 | RAG记忆管理页面搜索记忆功能：搜索框右边加状态按钮切换语义搜索/纯文本搜索，默认开启语义搜索 | 高 |
| 15 | 检查RAG功能切换模型时是否顺利完成备份记忆、重新嵌入新维度记忆，测试打断后能否恢复 | 高 |
| 16 | RAG记忆管理页面手动添加回忆，确认时直接发送请求到向量嵌入模型，成功后才保存，失败则报错，同步i18n | 高 |

**涉及模块:**
- `packages/ui/src/web/RagMemoryView/`
- `packages/ai/src/rag/`
- `packages/database/src/repositories/memory.repository.ts`

---

## Agent 4: 设置与 UI 细节

**负责任务:** 1, 9, 21, 25, 32, 33

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 1 | 实现 Ctrl+- 缩小页面功能（目前只能 Ctrl+ 放大） | 中 |
| 9 | 网络搜索设置页面，选择搜索引擎时页面高度不够无法显示全部选项，需确保全部显示；删除"可以绕过反爬虫机制"提示；统一"Api密钥"为"ApiKey"，同步i18n | 高 |
| 21 | 常规设置-身份卡设置，"descriptionText"和"chipsScrollArea"应添加内边距，不紧挨软件边缘 | 低 |
| 25 | 全局默认模型增加TTS模型选项，需过滤出TTS模型；嵌入模型颜色改为与其他选项一致（不突出显示） | 高 |
| 32 | 快捷指令面板创建指令后，显示指令前面有一长串数字（可能是id），不需要显示 | 中 |
| 33 | 快捷指令面板显示指令应分页，默认5条一页，可选10、15、20、25、30 | 中 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/settings/`
- `packages/ui/src/web/WebSearchSettingsView/`
- `packages/ui/src/web/IdentitySettingsCard/`
- `packages/ui/src/web/AIGlobalModelsView/`
- `packages/ui/src/web/PromptShortcutSheet/`

---

## Agent 5: TTS 语音功能

**负责任务:** 26, 27

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 26 | 伙伴页面输入框上方工具栏加入TTS选项，选项为"始终开启"、"手动触发" | 高 |
| 27 | 每条AI回复消息底部加小喇叭标识，点击调用TTS模型播放语音；工具栏选择"始终开启"时AI回复后自动播放 | 高 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/agent/`
- `packages/ui/src/web/ChatBubble/`
- `packages/ui/src/web/InputBar/`
- `packages/ai/src/providers/` (TTS 模型调用)

**注意:** 需要先完成 Agent 4 的任务 25（TTS 模型选项）

---

## Agent 6: 伙伴聊天上下文与调试

**负责任务:** 22, 28, 29, 30, 31

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 22 | 伙伴聊天页面计费面板刷新价格表网络错误时，应正确给用户反馈消息（现在只在控制台提示） | 中 |
| 28 | 检查伙伴编辑页面上下文轮数大小选项是否生效，确保AI回复过程中的工具调用、网络搜索等内容完整截取 | 高 |
| 29 | 伙伴编辑页面记忆设置部分：状态和开关同一行，下面"触发压缩条件"和token量显示同行，在右侧加小按钮显示悬浮提示 | 中 |
| 30 | 伙伴页面每次AI回复消息下加按钮，点击可查看发送给AI的上下文（压缩内容、原文、提示词） | 高 |
| 31 | 对话分支功能：确保每条AI回复可从对应位置创建分支，复制新会话并截取到选择位置 | 高 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/agent/`
- `packages/core/src/session/`
- `packages/ai/src/agent/`
- `packages/ui/src/web/ContextChainDialog/`

---

## Agent 7: 回忆生成页面

**负责任务:** 17

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 17 | 回忆生成页面两个card section连接处不要圆角，合并为同一个card section；周记、月报、季报、年鉴前面emoji分别改为🌱☘️🪴🌳 | 中 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/summary/`
- `packages/ui/src/web/SummaryDashboard/`

---

## Agent 8: 记忆画廊

**负责任务:** 19

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 19 | 记忆画廊页面，点击侧边栏切换回忆时不进入编辑（仅切换），点击编辑图标（笔）才进入编辑页面（编辑页面和日记编辑一样） | 中 |

**涉及模块:**
- `apps/desktop/src/renderer/src/features/summary/`
- `packages/ui/src/web/GalleryPanel/`

---

## Agent 9: 文件附件系统

**负责任务:** 18

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 18 | 文件支持系统：日记中可上传附件（图片、视频、音频），支持复制粘贴上传，附件存储到当月文件夹的attachment目录，支持右键打开所在文件夹/复制附件，图片预览及缩放，附件作为引用链接在编辑器渲染，预览时也渲染媒体，检查日记预览是否正确部分渲染 | 高 |

**涉及模块:**
- `packages/core/src/attachments/`
- `apps/desktop/src/main/ipc/attachment.ipc.ts`
- `apps/desktop/src/renderer/src/features/diary/`
- `packages/ui/src/web/DiaryEditor/`

**此任务较大，建议拆分为子任务:**
1. 附件上传与存储机制（文件移动到attachment文件夹）
2. 附件右键菜单（打开文件夹、复制附件）
3. 图片预览与缩放功能
4. 编辑器中附件引用链接渲染
5. 日记预览页面媒体渲染
6. 日记预览部分渲染检查

---

## 任务依赖关系

```
Agent 4 (TTS模型选项) → Agent 5 (TTS语音功能)
Agent 1 (日记筛选) ← 独立
Agent 2 (伙伴UI) ← 独立
Agent 3 (RAG记忆) ← 独立
Agent 6 (上下文调试) ← 独立
Agent 7 (回忆生成) ← 独立
Agent 8 (记忆画廊) ← 独立
Agent 9 (文件附件) ← 独立
```

## 建议执行顺序

1. **第一批次（可并行）:** Agent 1, Agent 2, Agent 3, Agent 4, Agent 7, Agent 8
2. **第二批次:** Agent 5（依赖 Agent 4）, Agent 6
3. **第三批次:** Agent 9（工作量最大，可独立进行）

---

## i18n 注意事项

涉及 i18n 修改的任务需要同步更新以下文件：
- `packages/shared/src/i18n/zh.i18n.json`（简体中文）
- `packages/shared/src/i18n/en.i18n.json`（英文）
- `packages/shared/src/i18n/ja.i18n.json`（日文）
- `packages/shared/src/i18n/zh_TW.i18n.json`（繁体中文）

涉及的任务: 8, 9, 12, 16
