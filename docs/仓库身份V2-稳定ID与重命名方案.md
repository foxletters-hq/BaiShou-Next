# 仓库身份 V2：稳定 ID 与重命名

> 版本：v0.2
> 日期：2026-08-04
> 一句话：工作空间（Vault）**没有 ID**，身份就是名字字符串——名字同时充当磁盘目录名、数据库外键、向量分组前缀和同步路径首段。本方案引入稳定 ID，把内部引用全部迁过去，从而让「重命名」成为可能。
> 前置：[仓库隔离V1-数据面隔离方案.md](./仓库隔离V1-数据面隔离方案.md)（V1.0–V1.3 已落地）
> 时序：**插在 V1.4 之前**——V1.4 要给 `summaries` / `agent_assistants` 加仓库列，先定下 ID 就能让它们直接用 `vault_id`，省掉一次二次迁移。
> **实现进度：V2.0–V2.4 已落地**（历史坑 / 稳定 ID / 六表迁 `vault_id` / 传递层 / 朴素重命名），未发布；**V2.5（服务端 rename pass）未开工**

---

## 一、结论先行

`VaultInfo` 只有四个字段，没有 ID：

```1:6:packages/core/src/vault/vault.types.ts
export interface VaultInfo {
  name: string
  path: string
  createdAt: Date
  lastAccessedAt: Date
}
```

`vault_registry.json` 序列化的也是这四个字段。仓库的身份从头到尾是那个名字字符串，它被烙进了约 65 个契约点：6 张表的列、两套向量分组字符串约定、磁盘目录名、JSONL 内容字段、增量同步的路径首段。

之所以至今没出事，是因为**产品里没有重命名入口**。名字一旦定下就不会变，所以「名字即身份」在实践中一直成立。代价是重命名这个功能永远做不了，而且每新增一张按仓库过滤的表，就多一处绑死在名字上。

本方案的目标不是「加个字段」，而是**把身份和显示名拆开**：ID 负责内部引用，名字负责给人看和当目录名。

---

## 二、产品决策：目录名跟着显示名走

先把最大的产品岔路口交代清楚。引入 ID 之后，磁盘目录用什么命名有三种选择：

| 选择 | 改名代价 | 用户感受 |
| --- | --- | --- |
| 目录名 = ID（`vlt_a3f9c2/`） | 零 | 打开存储根看到一堆乱码目录 |
| 目录名固定为创建时的名字 | 零 | 界面叫「工作」，文件夹还叫 `Personal` |
| **目录名跟着显示名改**（本方案） | 见 §五 | 所见即所得 |

**选第三条。** 白手的核心承诺之一是「你的数据就是你自己文件夹里的普通 Markdown」，用户是真的会去翻那个目录的。让目录名和界面显示名脱节，等于在这个承诺上开了个口子。

代价是改名要动同步路径。§五 专门讲怎么让这个代价可控。

---

## 三、三级 ID 来源：为什么不能只放注册表

最直觉的做法是往 `vault_registry.json` 里加个 `id` 字段就完事。这有两个坑。

### 坑一：升级窗口期，两台设备各自生成不同 ID

设备 A 和设备 B 都有仓库 `Personal`。A 先升级，生成 `id=X`；B 后升级，生成 `id=Y`。注册表参与同步（见下），三方合并会判成冲突，一方覆盖另一方。假设 A 赢，B 的注册表变成 `id=X`——但 B 的数据库里已经按 `id=Y` 回填完了。数据全断。

**解法：存量仓库的 ID 从名字确定性派生。** `vaultId = 'vlt_' + sha256(name).slice(0, 16)`。A 和 B 独立升级会得到同一个 ID，不需要任何设备间协调。**只有新建的仓库才用随机 ID。**

### 坑二：老版本客户端会吃掉 id 字段

注册表**本身就在同步**，被归到 `__root__` 作用域：

```10:20:packages/shared/src/sync/incremental-sync-plan.util.ts
const ROOT_SCOPE = '__root__'
const UNKNOWN_SCOPE = '__unknown__'
const ROOT_FILES = new Set(['vault_registry.json'])

export function resolveIncrementalSyncVaultScope(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (ROOT_FILES.has(normalized)) return ROOT_SCOPE
```

这是个好消息（ID 天然跨设备一致），但也意味着**没升级的设备会参与写入**。老版本的 `saveRegistry` 只写四个已知字段：

```426:438:packages/core/src/vault/vault.service.ts
    const jsonStr = JSON.stringify(
      this._vaults.map((v) => ({
        name: v.name,
        path: v.path,
        createdAt: v.createdAt.toISOString(),
        lastAccessedAt: v.lastAccessedAt.toISOString()
      }))
    )
```

老设备读到带 `id` 的注册表 → 解析时丢弃 → 保存时不写 → 上传 → 新设备拿回一份没有 ID 的注册表。

**解法：ID 的真值不能只有注册表一处。**

### V2-D1：三级 ID 来源，按优先级回落

| 优先级 | 来源 | 说明 |
| --- | --- | --- |
| 1 | `<vault>/.baishou/vault.json` | 仓内元数据文件，老版本不认识也不会碰它 |
| 2 | `<root>/vault_registry.json` 的 `id` 字段 | 快路径，避免每次读 N 个文件 |
| 3 | 从名字确定性派生 | 兜底；纯本地新建、或前两者都丢失时 |

读到 ID 后，缺失的那几级要**回写补齐**。

`.baishou/` 已经是系统目录约定（settings、external_paths 都在里面），创建仓库时已经 `mkdir` 过，落点合适：

```367:373:packages/core/src/vault/vault.service.ts
  private async addNewVault(vaultName: string, options?: { touchAccess?: boolean }): Promise<void> {
    const newPath = await this.pathService.getVaultDirectory(vaultName)
    await this.fileSystem.mkdir(newPath, { recursive: true })
    await this.fileSystem.mkdir(await this.pathService.getVaultSystemDirectory(vaultName), {
      recursive: true
    })
```

**`vault.json` 必须纳入同步白名单。** 注意 `.baishou/external_paths.json` 目前是被**排除**同步的（它存的是本机绝对路径），不要照抄它的规则。

`vault.json` 内容极简，只放不会因设备而异的东西：

```json
{ "id": "vlt_a3f9c2b1d4e5f607", "displayName": "工作", "createdAt": "2026-08-04T..." }
```

`path` 不进去——那是本机的。

---

## 四、内部引用怎么迁

### V2-D2：数据库列一律改成 `vault_id`

已有六张表带仓库列：

| 表 | Schema | 现列 | 备注 |
| --- | --- | --- | --- |
| `agent_sessions` | `packages/database/src/schema/agent-sessions.ts` | `vault_name` NOT NULL | 无独立索引 |
| `memory_embeddings` | `packages/database/src/schema/vectors.ts` | `vault_name` 可空 | V1.0 刚加，尚未发布 |
| `graph_nodes` | `packages/database/src/schema/graph.ts` | `vault_name` NOT NULL | 有索引 |
| `graph_edges` | 同上 | `vault_name` NOT NULL | 有多个索引 |
| `diary_embed_jobs` | `packages/database/src/schema/diary-embed-jobs.ts` | `vault_name` NOT NULL | 唯一键含它 |
| `journals_index` | `packages/database/src/schema/shadow-index.ts` | `vault_name` NOT NULL | 在独立的 `shadow_index_v2.db` |

全部改名为 `vault_id`，回填靠注册表的 name→id 映射。**`memory_embeddings` 那列还没发布，改起来只是改代码，不需要额外的用户数据迁移。**

V1.4 待加的 `summaries` / `agent_assistants` 直接加 `vault_id`，不走 `vault_name`。

### V2-D3：`source_id` 前缀换成 ID，`group_id` 停止写入仓库名

向量库里有两套字符串烙印：

- `group_id`：`memory:${vaultName}` / `diary:${vaultName}`
- `source_id`：`${vaultName}#${diaryId}`

有了 `vault_id` 列之后，`group_id` 里的仓库名纯属冗余。**新写入不再拼仓库名**（写 `memory` / `diary` 即可），所有反向解析 `group_id` 取仓库名的代码全部删除，改读列。存量行不动——列已经回填过了。

`source_id` 不一样，它的仓库前缀承担着**全局唯一性**：`deleteEmbeddingsBySource(sourceType, sourceId)` 这类按 source 删除的操作，如果 `diaryId` 只在仓库内唯一，去掉前缀会误删别的仓库。所以**保留 `前缀#diaryId` 结构，把前缀从名字换成 ID**，存量行在迁移时一次性重写（纯 DB 操作，不涉及文件同步）。

### V2-D4：文件里的 `vaultName` 字段不重写，读取侧改为以路径 / 上下文为准

三类同步文件的内容里带着仓库名：

- `<vault>/Memory/*.jsonl` 的 `MemoryRawRecord.vaultName`
- `<vault>/Graph/**/*.jsonl` 的 node / edge `vaultName`
- `<vault>/Sessions/{id}.json` 的 `AgentSessionSchema.vaultName`

**改名时绝对不能重写这些文件。** 一个用户可能有几十个 JSONL 分片和几百个会话 JSON，重写会让它们的 hash 全变，改名瞬间变成一次全量重传——那就把 §五 的优化全毁了。

做法：新增可选 `vaultId` 字段，**新写入时同时写 `vaultId` 和 `vaultName`**；读取侧优先取 `vaultId`，没有则从文件路径推导所属仓库，`vaultName` 降级为「写入时的快照，仅供人阅读」，任何逻辑都不得依赖它。老文件一律不动。

施工时要逐一排查现有的读取点，确认没有代码把这个字段当真值用。

### V2-D5：展示层继续用名字

以下位置**不要**换成 ID：

| 位置 | 形式 |
| --- | --- |
| 工作空间切换器 / 管理页 | `activeVault.name` |
| System prompt | `Vault: ${vaultName}`、`[Current Vault / Workspace]: ${vaultName}` |
| MCP 握手指令 | `Current workspace: ${vaultName}` |
| 增量同步确认弹窗 | 按仓库名分组展示计划 |
| 错误文案 | `VaultNameExistsError` 等 |

给模型看的 prompt 尤其重要——`vlt_a3f9c2b1` 对模型没有任何语义，`工作` 才有。

### V2-D6：活跃仓库改为显式字段

现在的活跃仓库靠 `lastAccessedAt` 最大者推断：

```229:236:packages/core/src/vault/vault.service.ts
  public getActiveVault(): VaultInfo | null {
    if (this._vaults.length === 0) return null
    return (
      [...this._vaults].sort(
        (a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
      )[0] || null
    )
  }
```

这个推断依赖时钟单调，且注册表是同步的——A 设备切了仓库，B 设备同步后活跃仓库会跟着变。这未必是用户想要的（活跃仓库是本机偏好，不是共享状态）。

既然要动注册表结构，顺手把活跃仓库改成**本机独立存储的 `activeVaultId`**（桌面 `baishou_settings.json`，移动 AsyncStorage），不进同步。`lastAccessedAt` 保留但降级为展示用的排序依据。

**这条是可选项**，如果 V2.1 的改动面已经够大，可以拆到后面单独做。但要在同一份方案里记着，别忘了。

---

## 五、重命名：让它别变成一次全量重传

这是整个方案最需要小心的部分。

### 5.1 现状：同步完全按路径键，没有任何重命名检测

`three-way-merge` 按路径并集迭代，不做跨路径的内容匹配。把 `Personal/` 改成 `工作/`，对每个文件：

- 旧路径 `Personal/x`：本地无、远端有、祖先有 → `delete-remote`
- 新路径 `工作/x`：本地有、远端无、祖先无 → `upload`

5000 个文件 / 500MB 的仓库，就是 5000 次删除 + 500MB 上传；其它设备再 5000 次本地删除 + 500MB 下载。

更麻烦的是删除保护形同虚设：`isLocalInitiatedDeleteRemotePropagation` 会判定这是「本地发起的删除」，直接放行，不触发 mass_delete 拦截。

### 5.2 好消息：服务端移动的原语早就有了

```33:51:packages/core/src/network/cloud-sync.interface.ts
export interface ICloudSyncClient {
  uploadFile(localFilePath: string, remoteRelPath?: string): Promise<void>
  downloadFile(remoteFilename: string, localDestPath: string): Promise<void>
  listFiles(): Promise<SyncRecord[]>
  deleteFile(remoteFilename: string): Promise<void>
  /** 重命名云端文件 (S3 = copy+delete, WebDAV = move) */
  renameFile(oldFilename: string, newFilename: string): Promise<void>
}
```

桌面两个 provider 都实现了：S3 走 `copyObject` + `removeObject`（服务端复制，字节不出云），WebDAV 走 HTTP `MOVE`（**可以整目录一次搬完**）。只是增量同步引擎从来没调用过——目前只有全量 ZIP 备份的改名在用。

缺口在移动端：`MobileIncrementalCloudClient` 没实现 `renameFile`。

### V2-D7：改名分两步交付，先正确后便宜

| 阶段 | 同步行为 | 用户感受 |
| --- | --- | --- |
| **V2.4 朴素路径** | 老老实实 delete + upload | 能改名，改名前弹窗明确告知「将重新上传约 X MB」 |
| **V2.5 服务端移动** | rename pass 走 `renameFile` | 改名几乎瞬时，其它设备零下载 |

先交付 V2.4 有两个理由：它不动合并算法，风险可控；而且 V2.5 的失败回落路径**就是** V2.4，先把它做对，优化才有安全网。

V2.4 的弹窗依赖 [同步流量护栏 S1](./同步流量护栏S1-移动数据提示方案.md) 的字节统计能力——目前同步计划只统计文件条数，不汇总字节。**所以 S1.0 要排在 V2.4 之前。**

### 5.3 本地改名流程

```
1. 校验新名合法（validateVaultName）且不与现有仓库重名
2. 磁盘目录改名 <root>/Personal → <root>/工作
3. 注册表：id 不变，name / path 更新
4. <vault>/.baishou/vault.json：id 不变，displayName 更新
5. 本地 manifest 的路径键迁移 Personal/* → 工作/*（hash / size / mtime 全部保留）
6. 祖先快照【不动】
```

**第 6 步是关键，反直觉但必须如此。** 祖先快照代表「上次和远端一致的状态」，远端此刻还是旧路径，祖先就必须留在旧路径。如果把祖先也迁了，三方合并会看到「本地有、祖先有、远端无」，判成 `delete-local`——把用户刚改完名的文件全删了。

### 5.4 rename pass 的设计（V2.5）

在正常三方合并**之前**插一个 pass：

```
输入：本机 id→当前目录名映射、上次同步时的 id→目录名映射
检测：某个 id 的目录名变了，且远端 manifest 里存在旧前缀
动作：对该前缀下每个文件调 renameFile(旧路径, 新路径)
      WebDAV 可尝试整目录 MOVE 一次搞定
善后：把远端 manifest 与祖先快照的路径键一并迁移到新前缀
失败：整个 pass 放弃，回落到 V2.4 的朴素路径（正确性不受影响）
```

「上次同步时的 id→目录名映射」需要新存一份，建议 `.baishou/last-remote-vaults.json`，和 `last-remote-manifest.json` 同时写入、同时提交。不能从祖先 manifest 的路径前缀反推——那只能知道有哪些目录名，不知道哪个前缀对应哪个 ID。

pass 跑完后，本地 / 远端 / 祖先三方的路径都已对齐，正常合并会全部判 `skip`。

### 5.5 其它设备怎么跟随

设备 B 同步时：

1. 从远端拿到新注册表，发现 `id=X` 的仓库名字变了
2. 本地磁盘目录改名
3. 本地 manifest + 祖先快照的路径键**都迁移**（这里和改名方不同——B 的祖先此刻确实应该跟着远端走）
4. 正常合并 → 全部 `skip`，零传输

### V2-D8：改名冲突按注册表合并结果收敛

A 改成「工作」，B 同时改成「Work」。注册表是普通文件，走既有的三方合并冲突处理，一方赢。输的一方在下次同步时发现「远端 `id=X` 叫工作，我本地叫 Work」，按 §5.5 的跟随流程再改一次本地目录即可。

**不需要为改名单独设计冲突机制**，注册表的合并结果就是唯一真相。

### V2-D9：中断处理——改名不做事务，靠幂等收敛

本地改名的 6 个步骤如果中途失败（比如目录改名成功但注册表没写），下次冷启动的 `syncRegistryWithDisk` 会扫盘发现「有个目录叫工作但注册表没有」，读到它 `.baishou/vault.json` 里的 `id=X`，认出这就是注册表里那个 `id=X` 的条目，把名字和路径纠正过来。

**这正是三级 ID 来源里 `vault.json` 优先级最高的第二个理由**——它让「目录和注册表不一致」变成可自愈的状态，而不是产生一个幽灵仓库。

现有的扫盘逻辑只认文件夹名：

```249:254:packages/core/src/vault/vault.service.ts
  public async syncRegistryWithDisk(): Promise<string[]> {
    const rootDir = await this.pathService.getRootDirectory()
    const diskNames = await listDiskVaultFolderNames(this.fileSystem, rootDir)
    const missing = diskNames.filter((name) => !this.registryCoversDiskFolder(name))
    return this.ensureVaultsRegistered(missing)
  }
```

要改成「先读 `vault.json` 认 ID，认不到才按名字新建」。

---

## 六、顺带修的三个历史坑

这三个都独立于 ID 改造，但都在仓库名这条线上，一起修掉。

### 6.1 `group_id` 解析的 off-by-one

`packages/shared/src/utils/migration-backup.util.ts` 用 `groupId.slice(8)` 取仓库名，但 `memory:` 前缀长度是 **7**——`memory:Personal` 被解析成 `ersonal`。

旁边 diary 的 `slice(6)` 是对的（`diary:` 确实是 6），SQL 侧的 `substr(group_id, 8)` 也是对的（SQLite 下标从 1 数）。就这一处错了。

V2-D3 会删掉大部分 `group_id` 解析代码，但这个函数在删除前的过渡期仍在跑，**先修再迁**。

### 6.2 大小写导致的注册表 / 磁盘不一致

注册表判重用严格 `===`，不做大小写折叠：

```328:330:packages/core/src/vault/vault.service.ts
    if (this._vaults.some((v) => v.name === name)) {
      throw new VaultNameExistsError(name)
    }
```

Windows 和默认配置的 macOS 文件系统不区分大小写，于是 `Work` 和 `work` 会被注册成两个仓库、落到同一个磁盘目录上——两个仓库的数据混在一起，而 DB 层因为字符串不同又认为它们是隔离的。Linux 上则确实是两个目录。

修法：创建和改名时按 case-insensitive 判重（用 `toLocaleLowerCase()` 比较），已经撞上的存量情况在注册表加载时检测并提示用户。

### 6.3 sanitize 撞名

```26:29:packages/core/src/vault/vault-name.util.ts
export function sanitizeVaultDirectoryName(vaultName: string): string {
  const sanitized = vaultName.replace(/[\\/:%#?*\x00-\x1f]/g, '_').trim()
  return sanitized || 'vault'
}
```

`a:b` 和 `a_b` 消毒后是同一个目录。`validateVaultName` 已经禁掉了这些字符，所以新建的不会踩，但历史遗留的目录名可能已经存在。

有了稳定 ID 之后这个坑的危害小很多（身份不再依赖目录名），但目录仍会物理冲突。修法：改名 / 创建时对**消毒后的目录名**也做一次判重，撞了就要求换名。

---

## 七、施工阶段

| 阶段 | 内容 | 验收 | 独立提交 |
| --- | --- | --- | --- |
| **V2.0** | 修 §六 三个历史坑 | 单测覆盖 off-by-one、大小写、sanitize 撞名 | **已落地** |
| **V2.1** | `VaultInfo` / 注册表 / `vault.json` 落地 ID；三级来源与回写；`vault.json` 纳入同步 | 升级后每个仓库都有 ID；删掉注册表 id 字段后能从 `vault.json` 恢复 | **已落地** |
| **V2.2** | 六张表 `vault_name` → `vault_id` + 回填；`source_id` 前缀换 ID；停写 `group_id` 仓库名 | 回填后无空值；A/B 隔离测试仍通过 | **已落地** |
| **V2.3** | 传递层迁 ID（IPC、`ToolContext`、path service、前端 scope key）；展示层保留名字 | 全链路 typecheck 通过；prompt 里仍是人类可读名 | **已落地** |
| —— | **回到 V1.4 / V1.5 / V1.6 / V1.7**，新增列直接用 `vault_id` | 见 V1 方案 | —— |
| **V2.4** | 重命名功能（朴素同步路径）+ 改名前字节量提示 | 改名后数据不丢；提示显示正确的 MB 数 | **已落地** |
| **V2.5** | 同步 rename pass（服务端移动）+ 移动端补 `renameFile` | 改名后同步计划为空；失败能回落 | 未开工 |

**V2.4 依赖 S1.0（同步计划字节统计）先落地。**

前置关系：V2.0 独立可先做；V2.1 → V2.2 → V2.3 必须顺序；V2.4 → V2.5 顺序。

---

## 八、风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| V2.2 迁六张表 + shadow db，回填出错就是数据错位 | 高 | 回填后跑一致性自检；`vault_id` 为空时 fail-closed（检索返回空而非全量），与 V1.0 同策略 |
| 老版本客户端吃掉注册表 `id` 字段 | 中 | 三级来源兜底，`vault.json` 老版本不碰；确定性派生作为最后一道 |
| 混合版本同步期，新旧设备对 `source_id` 前缀理解不同 | 中 | `source_id` 只在 DB 内，不进同步文件，两端各自迁移互不影响 |
| V2.5 动合并算法，改错会丢文件 | 高 | rename pass 失败即整体放弃回落朴素路径；pass 只做路径迁移不删内容；先在测试环境跑满 5000 文件规模 |
| 改名中断留下半改名状态 | 中 | V2-D9 的扫盘自愈；`vault.json` 是恢复锚点 |
| 移动端 `renameFile` 是新代码 | 中 | S3 用 CopyObject + Delete；WebDAV 用 MOVE；未实现时降级到朴素路径而非报错 |
| 确定性派生的 ID 在两个用户间相同（都叫 Personal） | 无 | 不同用户不共享云端存储，无实际影响 |

---

## 九、验收清单

**ID 落地**

1. 全新安装：创建仓库后 `vault.json` 与注册表都有 ID，且一致
2. 升级：存量仓库拿到确定性派生的 ID，两台设备独立升级后 ID 相同
3. 手动删掉注册表的 `id` 字段 → 冷启动后从 `vault.json` 恢复
4. 手动删掉 `vault.json` → 冷启动后从注册表回写
5. 两者都删 → 派生出与原来相同的 ID

**隔离不回退**

6. V1 的全部隔离测试在迁到 `vault_id` 后仍通过
7. `vault_id` 为空的行不出现在任何检索结果里

**重命名**

8. 改名后：日记、会话、记忆、图谱、总结、助手全部可见且完整
9. 改名后立即同步 → 数据不丢；改名后**不**同步直接重启 → 数据不丢
10. 改名过程中强杀进程 → 重启后自愈到一致状态
11. 设备 A 改名 → 设备 B 同步后目录跟着改，且**零下载**（V2.5）
12. A 与 B 同时改成不同名字 → 收敛到同一个名字，无数据丢失
13. 改成一个大小写不同的名字（`Work` → `work`）→ 在 Windows 上不损坏数据
14. 移动端改名 / 跟随改名与桌面同构

**历史坑**

15. `memory:Personal` 解析出 `Personal` 而非 `ersonal`
16. 创建 `work` 时若已有 `Work` → 明确报重名，不静默共用目录

---

## 十、决策记录

| 日期 | 决策 |
| --- | --- |
| 2026-08-04 | 引入稳定 `vaultId`，名字降级为显示名；**推翻 V1 方案 V-D8「本期不动仓库身份」** |
| 2026-08-04 | 插在 V1.4 之前做，让 `summaries` / `agent_assistants` 直接用 `vault_id` |
| 2026-08-04 | 磁盘目录名跟着显示名走，不用 ID 命名——「数据是你自己文件夹里的普通文件」优先 |
| 2026-08-04 | ID 三级来源：仓内 `vault.json` > 注册表 > 从名字确定性派生；解决升级期各设备独立生成与老客户端吃字段两个问题 |
| 2026-08-04 | 存量仓库 ID 确定性派生，新建仓库随机生成 |
| 2026-08-04 | `group_id` 停止写入仓库名并废除全部反向解析；`source_id` 保留前缀结构但换成 ID（承担全局唯一性） |
| 2026-08-04 | 同步文件里的 `vaultName` 字段不重写，读取侧改以路径 / 上下文为准——重写会让改名退化成全量重传 |
| 2026-08-04 | 改名分两步交付：先朴素 delete+upload（配 S1 字节提示），再上服务端移动优化 |
| 2026-08-04 | 本地改名时迁移本地 manifest 但**不动祖先快照**，否则合并会判成 delete-local |
| 2026-08-04 | 改名冲突不设专门机制，以注册表的三方合并结果为唯一真相 |
| 2026-08-04 | 活跃仓库改为本机独立存储、不进同步（可拆分为独立子项） |
| 2026-08-04 | 展示层（UI / system prompt / MCP 握手 / 同步预览）继续用名字，不换 ID |
