# 待办审查：证据口径

## 和现有审查的差别

| | 待办审查 | `/code-review` / Bugbot | 安全审查 |
|---|---|---|---|
| 问题 | 断言现在是否成立 | 这次改动引入了什么问题 | 这次改动有没有安全问题 |
| 输入 | 待办 / 计划 / 断言清单 / 过期复查 | 相关代码或相对基线的 diff | 相对基线的 diff |
| 证据 | `path:line` + 本轮跑绿的测试 | 缺陷位置 | 缺陷位置 |
| 「明确不做」 | 必须单列，禁止报成 bug | 无 | 无 |
| 输出 | Canvas 断言表 | Findings（按严重程度） | 同左 |

`/code-review` 或 Bugbot 绿了只说明「这次改动没扫出新问题」，不说明「待办里的断言已经落地」。

## 合格断言

- 好：`syncPendingIndex` 在分片未在场时不得缺席删除该月 SQLite 行
- 好：唯一索引冲突时内容寻址 id 胜出，输家 JSONL 有墓碑
- 好：同 `modelId` 且 dimension>0 的节点灌库不得再 `embedQuery`
- 坏：关系图谱还有性能问题（不可证伪）
- 坏：身份模型有缺陷（把决策当缺口）
- 坏：建议以后做人工合并（不是核查）

## 取证反例

- 只引用上一份聊天或另一份 AI 复查 → 作废
- 测试文件存在但本轮没跑 → 未核实
- `better-sqlite3` 不可用导致整组 skip → 未核实；应补一条不依赖该模块的测试，或换能跑的驱动再核
- 桌面有实现、移动只「看起来像」→ 未核实，直到两边都定位到同一套函数或对称实现
- 函数名对了、行为反了（例如 incoming 永远赢）→ 缺口，不要标通过

## 过期复查怎么处理

把外来清单拆成断言后，先标三类再取证：

1. 可能已落地 → 打开当前文件，按正常取证
2. 听起来像产品决策 → 先对「明确不做」栏，对不上再当缺口
3. 无法写成可证伪句子 → 丢掉，不要写进表

不要把外来清单原样贴进回复或画布。

## Canvas 写法

写画布前先读 Cursor canvas skill。只导入 `cursor/canvas`。颜色只用 `useHostTheme()`。

```tsx
import {
  BarChart,
  Callout,
  H1,
  Pill,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme
} from 'cursor/canvas'
```

状态靠 `Table` 的 `rowTone` 上色：通过 `success`，未核实 `warning`，明确不做 `info`，缺口 `danger`。不要用 `Pill` 的 tone（会被忽略）。  
`Stat`：通过 `success`，未核实 `warning`，缺口 `danger`；明确不做不用 tone。  
`BarChart` 一类一系，标题「断言条数（按状态）」，`valueSuffix=" 条"`。计数为 0 的状态不要进图。

聊天里用绝对路径链接，例如 `[关系图谱待办审查](/Users/<user>/.cursor/projects/<workspace>/canvases/todo-review-graph.canvas.tsx)`。
