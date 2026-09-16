# 组件索引

本文件是 `packages/ui` 的公开组件清单。写界面前先在这里查一遍：能用现成组件就直接引用，不要在页面里重新实现一份。

- 桌面端实现放在 `packages/ui/src/desktop/`，从 `@baishou/ui` 引入。
- 移动端实现放在 `packages/ui/src/native/`，从 `@baishou/ui/native` 引入。
- 两端共用的实现放在 `packages/ui/src/shared/`，由上面两个入口分别再导出。
- 主题数值只认 `packages/ui/src/theme/css-variables.css`，不要在页面里写死颜色、圆角、间距。

```ts
// 桌面端
import { Button, Switch, SegmentedControl } from '@baishou/ui'

// 移动端
import { Button, Switch } from '@baishou/ui/native'
```

## 维护约定

下面两段清单由 `scripts/sync-component-index.mjs` 生成，不要手工编辑。新增、重命名或删除公开组件后，把它登记到 `scripts/ui-component-index.manifest.json` 的对应分组，再执行 `pnpm sync`。

`pnpm ci:check` 会经由 `pnpm sync:check` 校验三件事：

1. 两个入口文件（`src/index.ts`、`src/native/index.ts`）导出的组件，都登记在 manifest 的某个分组里。
2. manifest 登记的组件，在 `packages/ui/src` 下真实存在。
3. 生成的清单与 manifest 一致，也就是没有漏跑 `pnpm sync`。

标记区块之外的说明文字是手写的，脚本不会改动。

## 官方零件（禁止在页面里再实现一份）

| 组件               | 说明                                                         |
| ------------------ | ------------------------------------------------------------ |
| `Switch`           | 默认尺寸 sm，轨道 42×24；需要大号时传 `size="md"`（52×32）   |
| `Checkbox`         | 业务文件里不允许再写 `type="checkbox"`                       |
| `SegmentedControl` | 分段切换，桌面端在 `src/desktop/shared/SegmentedControl.tsx` |
| `Button`           | 变体一律描边；默认 `outlined` + `size="small"`；不要撑满整行 |
| `Input`            | 单行输入框；设置区用 `fieldSize="small"`                     |
| `Select`           | 下拉选择；设置区用 `size="small"`                            |

以下三种做法都不允许：在页面里用 CSS 再画开关、勾选或分段控件；在业务文件里写 `type="checkbox"`；在移动端从 `react-native` 引入 `Switch` 或 `Checkbox`。实现只放在本包对应目录。

`pnpm ci:check` 会把两道检查都跑一遍：

- `pnpm lint`：ESLint 查 JSX 里的 `type="checkbox"`，以及移动端从 `react-native` 引入 `Switch` 与 `Checkbox`。
- `pnpm lint:css`：Stylelint 查样式里的 `:checked` 与 `[type=checkbox]`。只有 ESLint 时，把开关样式写进 `.css`、组件里只留 `className` 的写法能绕过检查。

其余规则见规则入口 [../../docs/1-AI-Code/0-README.md](../../docs/1-AI-Code/0-README.md)。

## 桌面端 `@baishou/ui`

<!-- desktop:start -->

- **输入与选择**：`Button` `Input` `Select` `Switch` `Checkbox` `SegmentedControl` `DatePicker` `TagInput` `ColorPicker`
- **展示与反馈**：`Badge` `Card` `Tooltip` `HelpTooltip` `SettingsHelpIconButton` `Toast` `Modal` `Dialog` `ContextMenu` `RestoreBlockingOverlay`
- **分页**：`Pagination` `PageSizeSelector`
- **页面骨架与设置区**：`SettingsPageChrome` `SettingsSection` `SettingsItem`
- **日记**：`DiaryCard` `DiaryMetaCard` `DiaryEditor` `DiaryEditorAppBarTitle` `MarkdownRenderer` `TimelineNode` `MoodIcon` `WeatherIcon`
- **总结与统计**：`SummaryCard` `MissingSummaryCard` `SummaryDashboard` `StatisticCard` `ActivityHeatmap` `GalleryPanel`
- **仪表盘**：`DashboardHeroBanner` `DashboardStatsCard` `DashboardSharedMemoryCard`
- **聊天消息流**：`ChatAppBar` `ChatBubble` `StreamingBubble` `AgentMarkdown` `ThinkingBlock` `MessageActionBar` `KnowledgeCitationBlock`
- **工具与压缩**：`AgentToolChain` `ToolResultGroupCard` `CompressionDivider` `CompressionActivityBar`
- **输入与用量**：`InputBar` `TokenBadge` `ContextUsageRing` `SessionContextUsageRing` `ReasoningEffortSelect`
- **会话与弹窗**：`AgentSessionList` `SessionListItem` `EmojiPicker` `RecallDialog` `ChatCostDialog` `ContextChainDialog` `ContextChainPanel`
- **AgentGate**：`AgentGateDock` `AgentGatePartBubble`
- **模型**：`ModelSwitcher` `ModelSwitcherPopup` `SessionModelMenu` `ModelVisionBadge`
- **助手**：`AssistantPicker` `AssistantPickerSheet` `PromptShortcutSheet` `AssistantAvatar` `AssistantAvatarPicker` `AssistantKindTabBar` `AssistantKindBadge` `AvatarEditor` `AvatarCropModal`
- **管理页与开发者选项**：`SessionManagementPage` `AssistantManagementPage` `AssistantManagementView` `AssistantEditPage` `AssistantMatrixCard` `GitManagementPage` `VersionHistorySidebar` `AttachmentManagementView` `DeveloperOptionsView`
- **同步与存储**：`IncrementalSyncPanel` `IncrementalSyncScopeList` `SyncModeComparisonNotice` `BackupScopeList` `LanSyncCard` `CloudSyncPanel` `DataManagementCard` `StorageSettingsCard` `WorkspaceSettingsCard`
- **外观与身份设置**：`AppearanceSettingsCard` `ProfileSettingsCard` `IdentitySettingsCard` `ChatBackgroundSettingsCard` `AboutSettingsCard`
- **模型与工具设置**：`AIModelServicesView` `AIGlobalModelsView` `TTSProviderSettings` `AgentBehaviorSettingsCard` `AgentToolsView` `WebSearchSettingsView` `McpSettingsCard` `HotkeySettingsCard`
- **记忆与总结设置**：`RagMemoryView` `SummarySettingsView` `EmojiSettingsView`
- **更新**：`UpdateChecker` `VersionManager`

<!-- desktop:end -->

## 移动端 `@baishou/ui/native`

<!-- native:start -->

- **输入与选择**：`Button` `Input` `Select` `Switch` `Checkbox` `SegmentedControl` `Slider` `DatePicker` `DateSelect` `YearMonthPicker` `DatetimePickerSheet` `TagInput` `ColorPicker` `MoodPicker` `WeatherPicker`
- **展示与反馈**：`Badge` `Card` `Tooltip` `Toast` `Modal` `FloatingModal` `Dialog` `ContextMenu` `RestoreBlockingOverlay`
- **分页与滚动**：`Pagination` `PageSizeSelector` `KeyboardAwareScrollView`
- **设置区骨架**：`SettingsSection` `SettingsItem` `SettingsExpansionTile` `SettingsListLeadingIcon` `SettingsGroupCard` `SettingsGroupDivider` `SettingsCardDivider` `SettingsSliderRow`
- **日记**：`DiaryCard` `DiaryMetaCard` `DiaryEditor` `DiaryEditorAppBarTitle` `MarkdownRenderer` `MarkdownToolbar` `TimelineNode` `MoodIcon` `WeatherIcon`
- **总结与统计**：`SummaryCard` `MissingSummaryCard` `SummaryDashboard` `StatisticCard` `ActivityHeatmap` `GalleryPanel`
- **仪表盘**：`DashboardHeroBanner` `DashboardStatsCard` `DashboardSharedMemoryCard`
- **聊天消息流**：`ChatAppBar` `ChatBubble` `StreamingBubble` `AgentMarkdown` `ThinkingBlock` `AgentThinkSection` `MessageActionBar` `KnowledgeCitationBlock`
- **工具与压缩**：`AgentToolChain` `ToolResultGroupCard` `CompressionDivider` `CompressionActivityBar`
- **输入与用量**：`InputBar` `TokenBadge`
- **会话与弹窗**：`AgentSessionList` `EmojiPicker` `RecallDialog` `ChatCostDialog` `ContextChainDialog`
- **AgentGate**：`AgentGateCard` `AgentGatePartCard`
- **模型**：`ModelSwitcher` `ModelSwitcherPopup` `ModelVisionBadge` `ProviderBrandIcon`
- **助手**：`AssistantPicker` `AssistantPickerSheet` `PromptShortcutSheet` `AssistantAvatar` `AssistantAvatarPicker` `AssistantKindTabBar` `AssistantKindBadge` `AssistantManagementView` `AssistantMatrixCard` `AssistantEditEmojiSection`
- **同步与存储**：`IncrementalSyncPanel` `IncrementalSyncProgressOverlay` `IncrementalSyncConfirmDialog` `IncrementalSyncScopeList` `SyncModeComparisonNotice` `BackupScopeList` `LanSyncCard` `CloudSyncPanel` `DataManagementCard` `StorageSettingsCard` `StoragePermissionPrompt` `WorkspaceSettingsCard` `AttachmentManagementView`
- **外观与身份设置**：`AppearanceSettingsCard` `ProfileSettingsCard` `IdentitySettingsCard` `ChatBackgroundSettingsCard` `AboutSettingsCard`
- **模型与工具设置**：`TTSProviderSettings` `AgentBehaviorSettingsCard` `AgentToolsView` `McpSettingsCard` `FeatureSettingsView`
- **记忆与总结设置**：`RagMemoryView` `SummarySettingsView` `EmojiSettingsView`

<!-- native:end -->
