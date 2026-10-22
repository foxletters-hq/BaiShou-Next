---
name: agy-cli
description: Runs the local agy CLI in non-interactive print mode and returns its output. Use when the user asks to use agy, run agy, 用agy, 用agy完成, 交给agy, 用agy校对, 用agy扫, or otherwise wants a task done by agy rather than only by the current agent.
version: 2026-10-23
---

# agy CLI

本机已安装并登录的 `agy` 命令行。用户要求用 agy 做某件事时，**主动调用**，不要只口头建议用户自己去跑。

不要用交互 TUI（直接敲 `agy` 会进会话）。用 `--print`。

## 前置

```bash
export PATH="$HOME/.local/bin:$PATH"
command -v agy
agy --version
```

找不到命令或报未登录：停下来告诉用户在本机终端执行 `agy` 完成登录，不要改用别的工具顶上。

## 调用

在仓库根目录执行。提示词必须贴在 `--print=` 上，否则会被当成别的 flag 的参数：

```bash
export PATH="$HOME/.local/bin:$PATH"
agy --dangerously-skip-permissions --output-format text --print-timeout 300s --print='<用户任务，写完整>'
```

| 用户意图                   | 额外参数                     |
| -------------------------- | ---------------------------- |
| 只分析、列出、校对、给结论 | 上面这条即可                 |
| 明确要 agy **改文件**      | 加上 `--mode accept-edits`   |
| 还要看别的目录             | `--add-dir <路径>`（可重复） |

不要默认加 `--sandbox`。从 Cursor 用 `--print` 调时没有交互授权，必须加 `--dangerously-skip-permissions`，否则会因 command 权限被拒而空跑。用户在自己终端交互跑 `agy` 时不要加这个 flag。

任务要写清：仓库路径、要做什么、约束（例如只改字号引用、不要提交、知识库不动）。把当前对话里已确认的约束写进 prompt，不要让 agy 自己猜。

## 超时与失败

- 默认 `--print-timeout 300s`。任务明显更长再加大，不要用 `0` 除非用户同意干等。
- 非 0 退出：把 stderr 原文给用户。登录/鉴权失败则请用户再跑一次 `agy` 登录。
- 成功：把 agy 的打印结果转述给用户；改了文件则核对 diff，不要替用户 commit。

## 模型

未指定模型时用 CLI 默认。用户点名模型再用 `--model`。可用列表：`agy models`。
