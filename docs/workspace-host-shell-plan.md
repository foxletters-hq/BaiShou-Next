# 工作台命令运行环境计划

本文记录：模型为什么会写出 `cmd /c`、工作台如何自己探测命令运行环境、以及分批落地。  
产品不提供「选系统 / 选壳」设置。本机探测后写入 `workspace_env` 和 `workspace_run` 说明，模型直接使用。

---

## 1. 问题拆开：不是「该用 cmd 还是 PowerShell」一件事

用户看到 `cmd /c mkdir ...`，容易以为模型「选了 cmd、没选 PowerShell」。  
实际是三层叠在一起：

| 层 | 谁决定 | 我们现在 | 模型因此怎么写 |
| --- | --- | --- | --- |
| 宿主壳 | 本机进程 | Windows 固定 `ComSpec` / `cmd.exe`，Unix 固定 `/bin/sh` | 不知道自己已经在哪个壳里 |
| 提示 | 系统提示 + 工具说明 | 只写 `Platform: win32`，`workspace_run` 只说 “Shell command” | 按训练集猜测 Windows = `cmd /c` |
| 匹配 | Agent Gate 白名单 / 黑名单 / 高风险 | 已能解开一层 `cmd /c`，再按 argv 前缀命中 | 包装层曾经把 `mkdir` 判成高风险，白名单也对不上 |

结论：模型用 `cmd /c`，主要不是因为它更适合，而是宿主已经用 cmd 执行，提示又没写明壳名，模型就再包一层。  
跨 Windows / Linux / macOS 的正确做法，不是把 `mkdir`、`md`、`New-Item` 收成同一条白名单，而是：**本机先选定一个壳，告诉模型这个壳，按这个壳执行，匹配时先去掉包装再取命令前缀。**

---

## 2. 参考项目实际怎么做（按源码核对，不是按宣传）

参考项目把「跑命令」拆成四条独立链路。工具对外名字仍叫 bash（兼容旧权限），内部已经按真实壳分流。

### 2.1 选壳：宿主先定，模型不定

优先级：

1. 用户配置里的 `shell`（设置页可改；空字符串会删掉该键，回到自动）。
2. 环境变量 `SHELL`。
3. 自动列表：
   - Windows：按「找得到」的顺序取第一个：`pwsh` → `powershell` → Git 自带的 bash → `COMSPEC` / `cmd.exe`。
   - macOS：`/bin/zsh`。
   - 其他 Unix：先 `bash`，没有再用 `/bin/sh`。
4. Unix 还会读 `/etc/shells`，设置页列出本机可用壳。

补充规则：

- `fish`、`nu` 标成「只适合终端，不适合当工具壳」。工具执行会跳过它们，改走可接受的壳。
- Windows 上写 `bash` 或 `/usr/bin/bash` 时，会先解析成 Git 自带的 `bash.exe`，而不是 PATH 里随便一个 bash。
- 壳名按文件名规范化：`C:\...\PWSH.EXE` → `pwsh`。
- 设置页第一项是「自动」，其余是本机探测到的壳；重名时改显示完整路径。

因此：在一台普通 Windows 上，只要装了系统自带的 Windows PowerShell 5.1（几乎都有），**自动模式选中的是 `powershell`，不是 `cmd`。**  
`cmd` 只是兜底。模型用 PowerShell 语法，是因为宿主选了它，并且下面第 2.2 节把壳名写进了工具说明。

我们这边正好相反：`workspace-host-process.ts` 在 Windows 上只读 `ComSpec`，几乎永远是 `cmd.exe`。

### 2.2 提示：把「操作系统 + 壳」写进工具说明

工具描述是按壳动态拼出来的，开头就有：

```
OS: ${os}, Shell: ${shell}
```

然后按方言给完整用法，而不是一句 “run a shell command”：

| 壳 | 提示里写什么 |
| --- | --- |
| `pwsh` | PowerShell 7+；可以用 `&&` / `\|\|`；优先完整 cmdlet |
| `powershell` | Windows PowerShell 5.1；**不要用 `&&`**，改写 `cmd1; if ($?) { cmd2 }` |
| `cmd` | 用双引号、`%VAR%`、`if exist`；链式用 `&&` |
| bash / zsh / sh | 标准 POSIX：`&&`、引号、不要 `cd &&`，改用 `workdir` |

所有方言都强调：

- 改目录用 `workdir` 参数，不要在命令里 `cd`。
- 读文件、搜文件、改文件用专用工具，不要用 `type` / `dir /s` / `Get-Content`。
- 互相依赖的命令放进同一次调用，按当前壳的链式语法写。

这就是「模型为什么在那边用 PowerShell、在我们这边用 cmd」的直接原因：**那边把壳名和语法写进工具说明，这边只写了平台。**

### 2.3 执行：按壳族拼启动参数，不再让模型包一层

选中壳之后，启动方式按族分流：

| 壳族 | 启动方式 |
| --- | --- |
| `pwsh` / `powershell` | 直接拉 exe，参数是 `-NoLogo -NoProfile -NonInteractive -Command <用户命令>` |
| `cmd` | 把整行交给该壳（Node 的 `shell` 选项，等价于 `cmd /c`） |
| bash / zsh | login + `-c`，并尽量带上用户自己的 rc / 别名 |

超时杀进程：

- Windows：`taskkill /t /f /pid`
- Unix：先杀进程组，再兜底杀子进程

Windows 上若当前是 Git bash，且参数以 `/` 开头，会先用 `cygpath -w` 转成盘符路径，再判断是否出工作区。

要点：模型应写 `mkdir foo` 或 `New-Item ...`，**不应再写 `cmd /c` 或 `powershell -Command`。**  
包装是宿主的事。

我们现在是：`spawn(用户整行, { shell: cmd.exe })`。  
模型再写 `cmd /c mkdir ...`，实际变成「cmd 再调 cmd」。这能跑，但 Gate 看到的是包装后的字符串。

### 2.4 权限：先按方言拆出子命令，再取「人能看懂的前缀」

执行前先扫描，不靠整行子串：

1. PowerShell 族用 PowerShell 语法树；其余（含 cmd）用 bash 语法树。
2. 拆出每条子命令。
3. 用 arity 表取出「可复用的 Always 前缀」，例如：
   - `git status -sb` → `git status *`
   - `npm run dev --watch` → `npm run *`
   - `mkdir a b` → `mkdir *`
   - `docker compose up` → `docker compose *`
4. 碰到会碰文件的命令（`rm` / `mkdir` / `New-Item` / cmd 的 `md` `del` `copy` 等），再解析路径；出了工作区就额外问 `external_directory`。
5. 权限规则是「权限名 + 模式」的通配，最后一条命中的生效。命令权限仍挂在历史名字 `bash` 上，避免旧配置失效。

他们**没有**做这些事：

- 没有把 `mkdir`、`md`、`New-Item` 收成同一条白名单。源码写明：别名归一以后集中做，现在不做，以免重复弹窗或放过能力更大的命令。
- 没有专门再解一层 `cmd /c`。前提是提示已经禁止模型再包装；模型若仍写 `cmd /c mkdir`，语法树看到的第一条命令是 `cmd`，Always 前缀会变成 `cmd *`，和 `mkdir *` 对不上。
- 没有单独的 cmd 语法树。cmd 走 bash 解析器，对简单命令够用，对复杂转义会变脆。
- 曾经有过「可移植扫描器」实验开关，后来标成不支持，不再走那条路。

---

## 3. 我们现在对应到哪

| 能力 | 参考项目 | 我们 |
| --- | --- | --- |
| 选壳 | 配置 → `SHELL` → 按平台探测 | Windows 固定 cmd，Unix 固定 `/bin/sh` |
| 设置页改壳 | 有「自动 + 本机列表」 | 无 |
| 告诉模型当前壳 | 工具说明写 `OS` + `Shell` + 方言用法 | `workspace_env` 只有 `Platform: win32` |
| 执行 | 按壳族拼参数 | `spawn(command, { shell: cmd.exe 或 /bin/sh })` |
| 包装 | 要求模型不要包；宿主自己包 | 模型常包 `cmd /c`；我们后补了解包 |
| 匹配 | 语法树拆子命令 + 大 arity 表 | 轻量分词 + 小 arity 表 + `unwrapWindowsCmdInvocation` |
| 高风险 | 权限规则 + 外部目录 | `DANGEROUS_SHELL_PATTERNS` + 可编辑黑名单 |
| 解释器 / 删除类 | 仍可问一次，Always 前缀很克制 | `python` / `cmd` / `powershell` / `rm` 等禁止落可复用 Always |
| 跨平台同义命令 | 明确不做 | 也不该做 |

我们已经做对、应保留的部分：

- `workspace_run` 禁止「整动作 Allow」，必须带命令前缀。
- Always 用 argv 前缀，不用整行子串。
- `cmd /c mkdir` 不再当高风险；白名单 `mkdir *` 可以命中包装后的 mkdir。
- 黑名单可编辑，并能恢复默认。
- 解释器（`cmd` / `powershell` / `python` / `bash -c`）不能落可复用 Always。

---

## 4. 目标架构

四层仍然独立。Linux / macOS 以后只换第 1 层的默认运行环境，后三层复用。

```
本机探测（无用户设置）
        ↓
   WorkspaceCommandRuntime（executable + family + label）
        ↓
   ┌────────────┬──────────────┬─────────────────┐
   │ 提示       │ 执行         │ Gate 匹配       │
   │ 平台 + 环境 │ 按 family 启动 │ 先解包装再前缀 │
   └────────────┴──────────────┴─────────────────┘
```

`family` 只保留四个：`win_console` | `win_powershell` | `win_pwsh` | `unix_shell`。  
不做设置页。`fish` / `nu` 跳过，改走兜底环境。

### 4.1 第 1 层：探测命令运行环境

模块：`packages/ai/src/agent-workspace/workspace-command-runtime.ts`。

- 输入：`platform`、`env.SHELL`、`env.ComSpec`、可选 `locate` / `exists`（测试注入）。
- 输出：`{ executable, binary, family, label }`。
- Windows 顺序：PowerShell Core → Windows PowerShell → Git 的 Unix 层 → 控制台。
- Unix：`SHELL` → macOS `/bin/zsh` → `bash` → `/bin/sh`。

### 4.2 第 2 层：提示与工具说明

`buildWorkspaceEnvLines` 增加两行：

- `Command environment: Windows console` / `Windows PowerShell` / `PowerShell Core` / `Unix shell (bash)`
- `Command environment family: win_console` 等

`workspace_run` 的 `description` 改为按 `kind` 生成：

- 写明当前壳。
- 写明链式语法。
- **明确禁止**再写 `cmd /c`、`cmd /k`、`powershell -Command`、`pwsh -Command`、`bash -lc`、`sh -c`。
- 继续强调用 `workdir`，不要在命令里改目录。

这一层不依赖换默认壳，单独做就能减少模型再包装。

### 4.3 第 3 层：按壳执行

改 `runHostProcess`：

- 入参增加已解析的 `WorkspaceCommandRuntime`，不要在函数内部再偷读 `ComSpec`。
- `powershell` / `pwsh`：`spawn(path, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command])`。
- `cmd` / `posix`：`spawn(command, { shell: path })`。
- 杀进程逻辑保持现状（Windows `taskkill /t`，Unix 进程组）。

### 4.4 第 4 层：匹配只认「真实命令」

在现有 `unwrapWindowsCmdInvocation` 上扩成 `unwrapWorkspaceCommandLine`：

| 包装 | 解开后 |
| --- | --- |
| `cmd /c ...`、`cmd.exe /k ...` | 内层 |
| `powershell -Command ...`、`pwsh -NoProfile -Command ...` | 内层 |
| `bash -lc ...`、`sh -c ...`、`zsh -c ...` | 内层 |

然后：

- 高风险、黑名单、白名单、Always 前缀，全部走解开后的文本。
- 仍禁止给 `cmd` / `powershell` / `pwsh` / `python` / `bash -c` 落可复用 Always。
- **不**把 `mkdir` 和 `New-Item` 当成同一条。用户允许 `mkdir *`，只覆盖 mkdir / 解开后的 mkdir；`New-Item` 要另问一次。
- arity 表可以逐步加长（`npm run` = 3、`docker compose` = 3），不必第一批上语法树。

第一批不上 tree-sitter：依赖重，参考项目自己的另一份核心实现里还写着「待移植」。我们的分词 + 解包装已经覆盖当前失败路径。语法树留作以后「链式命令里只想允许其中一段」再用。

---

## 5. 场景：人会看见什么

### 5.1 典型：Windows 工作台里建两个目录

现在：

1. 用户说「建素材和图像两个目录」。
2. 模型调用 `workspace_run`，命令是 `cmd /c mkdir "素材" "图像"`。
3. 宿主再用 `cmd.exe` 跑这一行。
4. Gate 卡片上是包装后的整行。白名单若写 `mkdir *`，解包之前会对不上；解包之后可以对上。

做完第 2 层（先不换默认壳）：

1. 提示写明「当前壳是 cmd.exe，直接写 `mkdir ...`，不要再包 `cmd /c`」。
2. 模型更常写出 `mkdir "素材" "图像"`。
3. 卡片和白名单都是 `mkdir *`。
4. 模型若仍包装，解包后照样命中。

若默认壳改成 PowerShell 5.1：

1. 提示写明不要用 `&&`，改用 `cmd1; if ($?) { cmd2 }`。
2. 模型可能写 `New-Item -ItemType Directory ...`，也可能仍写 `mkdir`（PowerShell 里 mkdir 是函数）。
3. 旧白名单 `mkdir *` 盖不住 `New-Item`。
4. 模型若继续写 `cmd /c mkdir`，会在 PowerShell 里再拉起 cmd，卡片上仍是包装命令。

### 5.2 认知落差

用户以为：AI 自己挑了 cmd。  
实际：宿主先挑了壳，模型在猜。  
卡片上若继续显示包装后的整行，用户会觉得白名单「写了也不认」。卡片应尽量显示解开后的真实命令，包装只作为次要说明。

### 5.3 平台差异（桌面以后上 Linux / macOS）

同一套 `WorkspaceCommandRuntime` + 解包装 + 前缀匹配。  
Linux / macOS 只换默认 `posix` 壳。  
不在桌面 Windows 上为 Linux 预埋同义表。

工作台命令目前是桌面专有（`DESKTOP_ONLY_WORKSPACE_TOOL_IDS`）。移动端不在本计划范围。

### 5.4 误操作

用户给 `mkdir *` 点「始终允许」：

- 应放行：`mkdir a`、`cmd /c mkdir a`、以后的 `mkdir a b`。
- 不应放行：`New-Item -ItemType Directory`、`mkdir a && del /s b`、`cmd /c rm -rf`。

链式命令继续整段询问，不按第一段白名单放行。这点我们已有，保持。

### 5.5 升级

已经存下来的白名单（`mkdir *`、`git status *`）必须继续有效。  
换默认壳不能让这些条目失效。  
若默认改成 PowerShell，需要在发布说明里写：新命令可能是 `New-Item`，要再允许一次。

跳过的维度：多设备同步、数据量堆积、离线冲突。宿主壳是本机进程配置，不进同步。

---

## 6. 分批落地

单次改动超过 10 个文件要拆批提交。下面按可独立验证的批次切。

### 第 0 批：先定默认壳（不写代码）

必须先选第 8 节的一项。未选定不要改 `resolveShell()` 的默认值。

### 第 1 批：提示 + 解包装扩面（建议先做，且不依赖换壳）

目标：模型少写 `cmd /c`；即使用户已经存了 `mkdir *`，包装后的命令也能命中。

改动范围（预估）：

- `packages/ai/src/agent/workspace-env.util.ts`：写入当前壳。
- `packages/ai/src/agent-workspace/workspace-run.tool.ts`：按 kind 生成说明。
- `packages/shared/src/baishou-agent-gate/agent-gate-shell-match.util.ts`：解包装覆盖 PowerShell / POSIX。
- 对应测试：`workspace-env.util.test.ts`、`agent-gate-shell-match.util.test.ts`、`workspace-command-scan.test.ts`、`system-prompt.builder.test.ts`。

验收：

- 系统提示能看到 `Command environment`。
- `powershell -Command mkdir foo` 能被 `mkdir *` 命中，且不标高风险。
- `powershell -Command rm -rf dist` 仍是高风险。
- `bash -c "mkdir foo"` 仍不能落 Always（解释器）。
- 现有 `cmd /c mkdir` 用例继续通过。

### 第 2 批：命令运行环境探测 + 按 family 执行

目标：执行层与提示层用同一份探测结果，不再各读各的环境变量。

改动范围：

- 新增 `workspace-command-runtime.ts`（探测 + family + 显示名）及测试。
- `workspace-host-process.ts` 接收 `WorkspaceCommandRuntime`。
- `WorkspaceRunTool.execute` 把会话里的壳传进去。
- Windows PowerShell 启动参数按第 4.3 节。
- `workspace-host-process.test.ts` 补 PowerShell / cmd 两条启动参数断言（可用 mock spawn）。

验收：

- 默认壳按第 8 节选定的规则解析。
- 配置或测试注入 `kind=powershell` 时，不再走 `shell: cmd.exe`。
- 超时 / 中止杀进程树仍然有效。

### 第 3 批：不做设置页

用户不选系统、不选运行环境。探测结果写入系统提示和工具说明，模型直接使用。

### 第 4 批（可选）：arity 加长、卡片显示解开后的命令

- `npm run` / `docker compose` / `pnpm dlx` 等与参考项目对齐的 arity。
- Gate 卡片主文案显示解开后的命令；包装作为次要行。
- 不上 tree-sitter，除非出现「一条链式命令里要单独放行其中一段」的真实需求。

### 第 5 批（以后，Linux / macOS 桌面）

- 同一套 `WorkspaceCommandRuntime`，默认走 `unix_shell`。
- 补 `/etc/shells` 或 `SHELL` 探测。
- 不新增跨平台同义白名单。

---

## 7. 明确不做

1. **不**把 `mkdir` / `md` / `New-Item` / `New-Item -ItemType Directory` 收成一条白名单。
2. **不**在第一批引入 tree-sitter 或 wasm 语法树。
3. **不**让用户或模型挑选运行环境。本机探测后写入提示。
4. **不**把 `cmd` / `powershell` / `python` / `bash -c` 做成可复用 Always。
5. **不**在工作台设置里塞笔记本导入（已删，不要加回来）。
6. **不**把宿主壳同步到其他设备。
7. **不**在计划或代码里抄参考项目的产品名。

---

## 8. Windows 探测顺序（已定，无设置项）

已选定：PowerShell Core → Windows PowerShell → Git 的 Unix 层 → 控制台。  
普通 Windows 通常落到 Windows PowerShell。用户不选，模型从 `workspace_env` 读取 `Command environment`。

旧白名单 `mkdir *` 仍然覆盖 `mkdir` 和包装后的 `mkdir`，不覆盖 `New-Item`。

---

## 9. 测试清单（按批）

第 1 批：

- `cmd /c mkdir` 命中 `mkdir *`，不标高风险（已有，保持）。
- `powershell -NoProfile -Command mkdir foo` 命中 `mkdir *`。
- `pwsh -Command "New-Item -ItemType Directory -Path a"` 不命中 `mkdir *`。
- `bash -lc 'mkdir foo'` 不能 `canPermanentlyAllow`。
- 系统提示含 `Command environment`。
- `workspace_run` 说明要求只写内层命令。

第 2 批：

- 解析：Windows 按第 8 节顺序。
- 解析：macOS 无 `SHELL` 时用 `/bin/zsh`。
- 启动参数：PowerShell 族带 `-Command`，控制台 / Unix 把命令交给该运行环境。

第 3 批：不做。

---

## 10. 建议的落地顺序

1. 第 1 批：提示 + 解包装。
2. 第 2 批：命令运行环境 + 按 family 执行。
3. 不做设置页。
4. Linux / macOS 与更细的命令拆分以后再说。
