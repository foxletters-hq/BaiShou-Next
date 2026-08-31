---
name: todo-review
description: Audits whether planned todos actually landed by checking atomic claims against current code and just-run tests, then renders the verdict as a Cursor Canvas. Use when the user asks for todo-review, /todo-review, 待办审查, 计划审查, 核查落地, 审查落地, 对照计划复查, or when another review listed leftover issues that may be stale or by-design. Do not use for ordinary bug hunts, /code-review, or security reviews.
---

# 待办审查

对照**当前代码 + 刚跑过的测试**，核验计划/待办是否真的落地。不写架构长文，不把产品决策报成缺陷。

不要用 `/code-review`、Bugbot 或安全审查代替本流程。那几套找的是 diff / 相关代码里的新问题，不回答「断言 X 现在是否成立」。

## 何时用哪套

| 用户要的 | 用 |
|---|---|
| 计划/待办有没有落地、另一份复查列了一堆问题 | **本 skill**（`todo-review`） |
| 这次改动有没有 bug / 回退 / 缺测试 | `/code-review` 或 `review-bugbot` |
| 这次改动有没有安全问题 | `review-security` |

可先后跑，不要混成一篇散文。

## 进度

```
待办审查：
- [ ] 1. 收断言清单（含「明确不做」）
- [ ] 2. 按切片打开当前代码，禁止只靠旧审查稿
- [ ] 3. 为待证断言跑测试
- [ ] 4. 写成 Canvas（禁止在聊天里贴核查表）
```

未到第 4 步不要写结论。用户没要求修代码时，不要改业务代码。第 4 步只写 `.canvas.tsx`。

## 1. 收断言清单

来源按优先级：用户点名的待办/计划/清单 > 本轮对话里已锁定的改造项 > 从当前 diff 反推的可证伪句子。

每条断言只说一件可真可假的事。把「同人异名是两个 id」「两套图隔离」这类已锁定决策放进 **明确不做**，禁止再当缺口。

切片（按不变量，不按文件名通读）：

- 身份 / 唯一索引 / 合并写回
- 同步对账 / 缺席删除 / 墓碑
- 灌库 / embed / 分片哈希
- 查询截断 / 分页 / 索引
- 审核口径 / 队列
- 桌面与移动是否走同一套函数

代码量太大时按切片分批查，每批只核自己的断言。不要一个上下文通读后补脑。

## 2. 取证

每条「待证」断言必须同时有：

1. **定位**：当前仓库的 `path:line`（或一次精确 grep 命中）。没打开当前文件 → 整行作废。
2. **测试**：一条会因该断言失败的测试，并且**本轮真的跑过**。只引用测试名、没执行 → 记「未核实」。

只给定位、不跑测试 → 「看起来写了」。  
测试绿了但对不上断言 → 「有测试，未核实这件事」。

跑测试用对应包的 `pnpm --filter <pkg> test -- <file>`，不要一上来全仓 `ci:check`。跳过的测试（`describe.skip` / 缺原生模块）不能当通过。

## 3. 判定

| 状态 | 条件 |
|---|---|
| 通过 | 定位 + 本轮测试绿，且行为与断言一致 |
| 未核实 | 缺定位、缺测试、测试被 skip、或只靠旧审查稿 |
| 明确不做 | 已锁定的产品/架构决策 |
| 缺口 | 当前代码与断言相反，且不是「明确不做」 |

「缺口」必须能指出期望行为 vs 实际行为（各一行）。不能把「另一份 AI 说过」当成缺口。

## 4. 写成 Canvas

先读 Cursor 的 canvas skill，再写一份独立核查画布。聊天里**不要**再贴断言 markdown 表。

**路径：** 工作区 `canvases/`（`~/.cursor/projects/<workspace>/canvases/`）。文件名 `todo-review-<主题>.canvas.tsx`，kebab-case。只写这一个文件，只从 `cursor/canvas` 导入，数据内联。

**画布必须有：**

1. 标题 + 一两句范围（核了什么、跑了哪些测试）
2. 四个 `Stat`：通过 / 未核实 / 明确不做 / 缺口（有数才用对应 tone）
3. 状态计数 `BarChart`（横条；标题写清「断言条数」）
4. `Table`：断言、状态、代码位置、测试、说明。`rowTone`：通过=`success`，未核实=`warning`，明确不做=`info`，缺口=`danger`（`Pill` 的 tone 会被忽略，不要靠它上色）
5. 若有未核实或缺口：一条 `Callout`，只写该先补哪条测试。没有则省略

禁止：空表、占位文案、emoji、渐变、硬编码色值、架构长文、其他产品名。

**聊天只留：** 一句范围 + Canvas 的 markdown 链接（绝对路径）+ 未核实/缺口各几条。不要展开改法，除非用户接着要求落地。

画布组件与色调见 [reference.md](reference.md)。
