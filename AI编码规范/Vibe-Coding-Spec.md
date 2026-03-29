# 白守 Next — AI 编码规范

> **本文档是所有 AI 协作者（包括但不限于 Claude、Gemini、GPT、Cursor、Copilot 等）的强制性行为准则。**
> 在开始任何编码工作之前，你必须完整阅读本规范并严格遵守。

---

## 黄金法则

> **"不写测试的代码不允许合并。不明确范围的工作不允许开始。"**

本项目采用 **TDD（测试驱动开发）+ SDD（规格驱动开发）** 结合的开发模式。每一行提交的代码都必须有对应的测试覆盖，每一个模块的实现都必须先有明确的规格文档。

---

## 目录

1. [工作流程总览](#一工作流程总览)
2. [Phase 0：工作准备（Worktree）](#二phase-0工作准备worktree)
3. [Phase 1：调研复用](#三phase-1调研复用)
4. [Phase 2：规格驱动设计（SDD）](#四phase-2规格驱动设计sdd)
5. [Phase 3：测试驱动开发（TDD）](#五phase-3测试驱动开发tdd)
6. [Phase 4：自测验证](#六phase-4自测验证)
7. [Phase 5：提交与合并](#七phase-5提交与合并)
8. [代码风格与约定](#八代码风格与约定)
9. [工程约定补充](#九工程约定补充)
10. [SOLID 设计原则](#十solid-设计原则)
11. [并行工作与 Worktree 策略](#十一并行工作与-worktree-策略)
12. [完成检查清单](#十二完成检查清单)

---

## 一、工作流程总览

> **技术栈声明：** 本项目使用 **pnpm** 包管理器、**Turborepo** 构建编排、**Vitest** 测试框架、**TypeScript 5.8+ strict 模式**。

每个任务必须按照以下流程执行，**不允许跳步**：

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AI 协作工作流程                                     │
│                                                                              │
│  Phase 0        Phase 1          Phase 2        Phase 3        Phase 4       │
│ ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│ │ 工作准备  │──▶│ 调研复用  │──▶│ 规格设计  │──▶│ TDD 编码  │──▶│ 自测验证  │  │
│ │ Worktree │   │ 不造轮子  │   │   SDD    │   │ 红→绿→重构│   │ 全量测试  │  │
│ └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│      │                │              │              │              │         │
│      ▼                ▼              ▼              ▼              ▼         │
│  创建分支        搜索已有实现     输出规格        先写测试       运行全部测试  │
│  明确范围        评估 npm 包      定义接口        再写实现       检查覆盖率   │
│  声明影响        记录调研结论     获得审批        持续重构       报告结果     │
│                                                                    │         │
│                                                             ┌──────▼──────┐ │
│                                                             │  Phase 5     │ │
│                                                             │  提交合并    │ │
│                                                             └─────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、Phase 0：工作准备（Worktree）

### 2.1 创建 Worktree

在开始任何工作之前，**必须**创建独立的 Git Worktree，将工作隔离在独立目录中。

```bash
# 1. 从 main 创建新分支并建立 worktree
git worktree add ../BaiShou-Next-<任务简称> -b <分支名>

# 示例：
git worktree add ../BaiShou-Next-diary-module -b feat/diary-module
git worktree add ../BaiShou-Next-fix-rag -b fix/rag-dedup-bug
```

### 2.2 分支命名规范

| 类型   | 格式                     | 示例                            |
| ------ | ------------------------ | ------------------------------- |
| 新功能 | `feat/<模块>-<描述>`     | `feat/diary-crud`               |
| 修复   | `fix/<模块>-<描述>`      | `fix/rag-memory-leak`           |
| 重构   | `refactor/<模块>-<描述>` | `refactor/ai-provider-registry` |
| 文档   | `docs/<描述>`            | `docs/api-reference`            |
| 测试   | `test/<模块>-<描述>`     | `test/agent-runner-edge-cases`  |
| 构建   | `chore/<描述>`           | `chore/turbo-config`            |

### 2.3 声明工作范围（SCOPE.md）

创建 worktree 后，**必须立即**在工作目录下创建 `SCOPE.md`。这是唯一的工作契约文件，调研结论也记录在这里：

```markdown
# 工作范围声明

## 任务描述

<简要描述本次任务的目标>

## 涉及的包/模块

- packages/core/src/diary/
- packages/database/src/schema/diaries.ts

## 不允许触碰的范围

- packages/ai/（不在本次任务范围内）
- apps/desktop/（不在本次任务范围内）

## 预期产出

1. diary.entity.ts — 日记实体定义
2. diary.service.ts — 日记业务逻辑
3. diary.service.test.ts — 单元测试（覆盖率 > 90%）

## 预估影响

- 新增文件：3 个
- 修改文件：1 个（packages/core/src/index.ts 导出）
- 删除文件：0 个

## 调研结论（Phase 0.5 完成后填写）

### 项目内调研

- <搜索了哪些包，是否有可复用的已有实现>

### npm 生态调研

| 方案 | Stars | 周下载量 | 类型支持 | 结论 |
| ---- | ----- | -------- | -------- | ---- |
| ...  | ...   | ...      | ...      | ...  |

### 决策

<最终采用什么方案，为什么>
```

> ⚠️ **严禁超出声明范围进行修改。** 如果发现需要修改范围外的代码，必须先更新 SCOPE.md 并获得批准。

---

## 三、Phase 1：调研复用

> **"不要重复造轮子。写代码之前，先证明没有现成的轮子可用。"**

在进入规格设计（SDD）之前，**必须**先完成以下调研：

1. **搜索项目内是否已有类似实现** — monorepo 全局搜索，检查 `packages/` 下所有包的导出
2. **搜索 npm 生态是否有成熟方案** — 对比至少 2-3 个候选，优先选维护活跃、类型完备的包
3. **评估「自研 vs 引入」**：
   - 现有包覆盖 80%+ 需求 → **引入**，不自研
   - 需要深度定制 → 可自研，但必须在 SCOPE.md 中说明理由
   - 项目内已有类似功能 → **复用/扩展**，不另起炉灶

调研结果填写到 SCOPE.md 的「调研结论」部分（模板见 Phase 0）。

**调研豁免**：fix 类型、纯重构、添加测试用例可跳过。

---

## 四、Phase 2：规格驱动设计（SDD）

SDD 要求在编写任何实现代码之前，先产出**明确的接口规格**。规格即契约，实现必须满足契约。

### 4.1 规格输出要求

对于每个模块，必须在编码前输出以下内容：

#### 类型/接口定义

```typescript
// ✅ 先定义接口
export interface DiaryRepository {
  findById(id: number): Promise<Diary | null>;
  findByDate(date: Date): Promise<Diary | null>;
  findByDateRange(start: Date, end: Date): Promise<Diary[]>;
  create(diary: CreateDiaryInput): Promise<Diary>;
  update(id: number, diary: UpdateDiaryInput): Promise<Diary>;
  delete(id: number): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<Diary[]>;
}
```

#### 函数签名与 JSDoc

````typescript
/**
 * 生成指定时间范围的周记总结。
 *
 * @param startDate - 周起始日期（周一）
 * @param endDate - 周结束日期（周日）
 * @param options - 生成选项
 * @returns 生成的周记内容（Markdown 格式）
 * @throws {NoDiaryFoundError} 指定范围内没有日记
 * @throws {AIProviderError} AI 调用失败
 *
 * @example
 * ```ts
 * const weekly = await generateWeeklySummary(
 *   new Date('2026-03-23'),
 *   new Date('2026-03-29'),
 *   { model: 'gemini-2.5-pro' }
 * );
 * ```
 */
export async function generateWeeklySummary(
  startDate: Date,
  endDate: Date,
  options?: SummaryGenerationOptions,
): Promise<string>;
````

#### 错误场景枚举

```typescript
// 每个模块必须定义可能抛出的错误类型
export class DiaryNotFoundError extends Error { ... }
export class DiaryDateConflictError extends Error { ... }
export class DiaryValidationError extends Error { ... }
```

### 4.2 规格审批

- 规格定义完成后，必须**先呈现给用户审阅**
- 获得明确批准（"可以"、"开始吧"、"ok"等）后才允许进入 Phase 2
- 如果用户提出修改意见，必须先修改规格再继续

---

## 五、Phase 3：测试驱动开发（TDD）

### 5.1 TDD 三步循环

严格遵循 **红 → 绿 → 重构** 循环：

```
┌──────────────────────────────────────────────┐
│                                              │
│   ① 红（Red）                                │
│   写一个会失败的测试                          │
│        │                                     │
│        ▼                                     │
│   ② 绿（Green）                              │
│   写最少的代码让测试通过                      │
│        │                                     │
│        ▼                                     │
│   ③ 重构（Refactor）                         │
│   改善代码质量，测试保持绿色                  │
│        │                                     │
│        └─────────▶ 回到 ①                    │
│                                              │
└──────────────────────────────────────────────┘
```

### 5.2 测试文件组织

```
packages/core/src/diary/
├── diary.entity.ts
├── diary.service.ts
├── diary.repository.ts
└── __tests__/
    ├── diary.entity.test.ts
    ├── diary.service.test.ts
    └── fixtures/
        └── diary.fixtures.ts      # 测试数据工厂
```

### 5.3 测试编写原则

#### 每个测试只验证一件事

```typescript
// ✅ 好的测试
it('should return null when diary not found', async () => {
  const result = await diaryService.findById(999);
  expect(result).toBeNull();
});

// ❌ 坏的测试（验证了多件事）
it('should handle diary operations', async () => {
  const created = await diaryService.create({ ... });
  expect(created).toBeDefined();
  const found = await diaryService.findById(created.id);
  expect(found).toEqual(created);
  await diaryService.delete(created.id);
  const deleted = await diaryService.findById(created.id);
  expect(deleted).toBeNull();
});
```

#### 测试命名规范

使用 `should <expected behavior> when <condition>` 格式：

```typescript
describe('DiaryService', () => {
  describe('create', () => {
    it('should create a diary with valid input', async () => { ... });
    it('should throw DiaryDateConflictError when date already exists', async () => { ... });
    it('should auto-generate tags from content when tags not provided', async () => { ... });
  });

  describe('search', () => {
    it('should return matching diaries when query matches content', async () => { ... });
    it('should return empty array when no matches found', async () => { ... });
    it('should filter by date range when dateRange option provided', async () => { ... });
  });
});
```

#### 必须覆盖的场景

| 场景类型  | 说明                               | 必须? |
| --------- | ---------------------------------- | ----- |
| 正常路径  | 标准输入，预期输出                 | ✅    |
| 边界值    | 空值、零值、最大值、边界日期等     | ✅    |
| 错误路径  | 无效输入、不存在的资源、权限不足等 | ✅    |
| 并发/竞态 | 多次同时调用的幂等性               | ⚠️    |
| 性能      | 大数据量下的响应时间               | ⚠️    |

#### Mock 规范

```typescript
// ✅ 使用依赖注入，方便 Mock
export class DiaryService {
  constructor(
    private readonly repo: DiaryRepository,
    private readonly fileService: FileService,
  ) {}
}

// 测试中注入 Mock
const mockRepo = {
  findById: vi.fn(),
  create: vi.fn(),
  // ...
} satisfies DiaryRepository;

const service = new DiaryService(mockRepo, mockFileService);
```

### 5.4 覆盖率要求

| 包                  | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| ------------------- | -------- | ---------- | ---------- |
| `packages/shared`   | ≥ 90%    | ≥ 85%      | ≥ 95%      |
| `packages/core`     | ≥ 85%    | ≥ 80%      | ≥ 90%      |
| `packages/ai`       | ≥ 80%    | ≥ 75%      | ≥ 85%      |
| `packages/database` | ≥ 80%    | ≥ 75%      | ≥ 85%      |
| `packages/store`    | ≥ 85%    | ≥ 80%      | ≥ 90%      |
| `apps/*`            | ≥ 70%    | ≥ 65%      | ≥ 75%      |

---

## 六、Phase 4：自测验证

### 6.1 自测是合并的前提

在声明"任务完成"之前，AI 必须**亲自运行**以下检查并报告结果：

```bash
# 1. 类型检查 — 零错误
pnpm typecheck

# 2. Lint 检查 — 零警告
pnpm lint

# 3. 单元测试 — 全部通过
pnpm test

# 4. 受影响包的测试 — 全部通过
pnpm test --filter=<受影响的包名>

# 5. 覆盖率报告（如适用）
pnpm test --coverage --filter=<包名>
```

### 6.2 自测报告模板

每次完成开发后，必须输出自测报告：

```markdown
## 自测报告

### 运行环境

- Node.js: v22.x
- pnpm: v10.x
- OS: Windows 11

### 检查结果

| 检查项          | 状态    | 详情                    |
| --------------- | ------- | ----------------------- |
| TypeScript 编译 | ✅ 通过 | 0 errors, 0 warnings    |
| ESLint          | ✅ 通过 | 0 errors, 0 warnings    |
| 单元测试        | ✅ 通过 | 42 tests, 42 passed     |
| 覆盖率          | ✅ 达标 | Lines: 91%, Branch: 86% |
| 集成测试        | ✅ 通过 | 8 tests, 8 passed       |

### 新增测试用例

- diary.service.test.ts: 15 个用例
- diary.entity.test.ts: 8 个用例
- diary.repository.test.ts: 12 个用例

### 已知限制

- <如有，列出已知的限制或待改进项>
```

### 6.3 自测失败处理

- 若任何检查项未通过，**不允许声明完成**
- 必须修复所有问题后重新运行检查
- 如果问题无法在当前范围内解决，必须在报告中明确说明并创建 Issue

---

## 七、Phase 5：提交与合并

### 7.1 Commit Message 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**类型定义：**

| type       | 说明                   |
| ---------- | ---------------------- |
| `feat`     | 新功能                 |
| `fix`      | Bug 修复               |
| `refactor` | 重构（不改变功能）     |
| `test`     | 添加/修改测试          |
| `docs`     | 文档变更               |
| `chore`    | 构建/工具/依赖变更     |
| `perf`     | 性能优化               |
| `style`    | 代码格式（不影响逻辑） |

**scope 使用包名：**

```bash
feat(core): add diary CRUD operations
fix(ai): resolve streaming response memory leak
test(database): add edge case tests for diary repository
refactor(shared): extract date utility functions
chore(root): update turbo.json pipeline config
```

### 7.2 提交前检查

```bash
# 必须在提交前运行
pnpm typecheck && pnpm lint && pnpm test
```

### 7.3 需要特别审批的变更

1. 添加新的外部依赖
2. 修改数据库 Schema
3. 修改公共接口签名（Breaking Change）
4. 修改构建配置 / CI/CD 配置

### 7.4 Worktree 清理

合并完成后：

```bash
cd ../BaiShou-Next
git merge <分支名>
git worktree remove ../BaiShou-Next-<任务简称>
git branch -d <分支名>
```

---

## 八、代码风格与约定

### 8.1 文件命名

```
kebab-case.ts          # 普通模块
kebab-case.test.ts     # 测试文件
kebab-case.types.ts    # 类型定义文件
PascalCase.tsx         # React 组件（PascalCase）
```

### 8.2 目录结构约定

```
src/
├── <domain>/
│   ├── <domain>.entity.ts         # 实体/模型
│   ├── <domain>.repository.ts     # 仓库接口
│   ├── <domain>.service.ts        # 业务逻辑
│   ├── <domain>.types.ts          # 类型定义
│   ├── <domain>.errors.ts         # 错误类型
│   ├── <domain>.utils.ts          # 工具函数
│   └── __tests__/
│       ├── <domain>.service.test.ts
│       └── fixtures/
│           └── <domain>.fixtures.ts
```

### 8.3 TypeScript 严格模式

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
  },
}
```

### 8.4 导入排序

```typescript
// 1. 外部依赖
import { z } from "zod";
import { streamText } from "ai";

// 2. 内部包（monorepo）
import { Diary } from "@baishou/shared";
import { DiaryRepository } from "@baishou/database";

// 3. 当前包内相对导入
import { validateDiaryInput } from "./diary.utils";
import { DiaryNotFoundError } from "./diary.errors";
```

### 8.5 错误处理

```typescript
// ✅ 使用自定义错误类，而非裸 throw
export class DiaryNotFoundError extends Error {
  constructor(public readonly diaryId: number) {
    super(`Diary with id ${diaryId} not found`);
    this.name = 'DiaryNotFoundError';
  }
}

// ✅ 函数签名中标注可能的异常
/**
 * @throws {DiaryNotFoundError}
 * @throws {DiaryValidationError}
 */
async function updateDiary(...) { ... }
```

### 8.6 异步代码

```typescript
// ✅ 始终使用 async/await
const diary = await diaryRepo.findById(id);

// ❌ 避免裸 Promise 链
diaryRepo.findById(id).then(diary => { ... });

// ✅ 并行操作使用 Promise.all
const [diary, summary] = await Promise.all([
  diaryRepo.findById(id),
  summaryRepo.findByDiaryId(id),
]);
```

### 8.7 注释规范

```typescript
// ✅ 解释"为什么"，而非"是什么"
// 使用 RRF 而非简单的分数加权，因为不同搜索引擎的分数尺度不可比
const fusedResults = reciprocalRankFusion(vectorResults, ftsResults);

// ❌ 无意义的注释
// 获取日记
const diary = await getDiary(id);
```

---

## 九、工程约定补充

### 9.1 测试框架

本项目统一使用 **Vitest** 作为测试框架。

```bash
# vitest.config.ts 已在各包中配置
pnpm test                    # 全量测试
pnpm test --filter=@baishou/core   # 指定包
pnpm test -- --watch         # 监听模式
pnpm test --coverage         # 覆盖率
```

- Mock 使用 Vitest 内置 `vi.fn()` / `vi.spyOn()` / `vi.mock()`
- 断言使用 Vitest 内置 `expect`（兼容 Jest API）
- **禁止**引入 Jest、Mocha 等其他测试框架

### 9.2 环境变量管理

```
BaiShou-Next/
├── .env.example          # 必须提交——所有变量的模板（值留空）
├── .env                  # .gitignore 忽略——本地开发环境变量
└── packages/
    └── ai/
        └── .env.test     # .gitignore 忽略——测试专用变量
```

**规则：**
- API Key 等敏感信息**只能**存在 `.env` 中，**严禁**硬编码或提交到仓库
- 新增环境变量时，**必须**同步更新 `.env.example`
- 跨包共享的变量在根 `.env` 定义，通过 Turborepo `globalEnv` 透传
- 测试中使用 `vi.stubEnv()` Mock 环境变量，不依赖真实 Key

### 9.3 日志规范

使用 `console` 的结构化封装（后续可替换为 `pino`）：

```typescript
// ✅ 使用分级日志
import { logger } from '@baishou/shared';

logger.info('Diary created', { diaryId: 42, date: '2026-03-29' });
logger.warn('Compression threshold approaching', { usage: 58000 });
logger.error('AI provider failed', { provider: 'gemini', error });

// ❌ 禁止裸 console.log
console.log('diary created');  // 不允许
```

**日志级别约定：**

| 级别    | 用途                                     |
| ------- | ---------------------------------------- |
| `error` | 不可恢复的错误，需要人工介入             |
| `warn`  | 可恢复但需关注的异常（降级、重试等）     |
| `info`  | 关键业务事件（创建/删除/同步完成等）     |
| `debug` | 开发调试信息（生产环境自动关闭）         |

### 9.4 依赖管理策略

**添加新依赖的前置条件：**

1. 在 SCOPE.md 的调研结论中说明为什么需要这个依赖
2. 优先选择：零依赖 > 依赖少 > 依赖多
3. 检查项：
   - 最近 6 个月有维护活动
   - TypeScript 类型完备（自带或 `@types/`）
   - 许可证兼容（MIT / Apache-2.0 / ISC）
   - 无已知安全漏洞（`pnpm audit`）
4. **需要用户审批**才能添加的依赖类型：
   - 包含 Native addon 的依赖
   - 体积 > 500KB 的依赖
   - 引入新的构建工具链

**版本锁定：**
- `dependencies` 使用 `^` 语义化版本
- `devDependencies` 使用 `^` 语义化版本
- 安全关键的依赖（如 `sqlite3`）使用精确版本锁定

### 9.5 单文件行数限制

> **铁律：单文件 ≤ 300 行（不含空行和注释）。**

- 超过 300 行的文件必须拆分
- 拆分优先级：按职责拆分 > 按功能拆分 > 按体积拆分
- 允许例外：自动生成的文件（如 Schema 定义、i18n 资源）
- 例外需在文件头部注释说明原因

---

## 十、SOLID 设计原则

本项目**强制遵循 SOLID 原则**。每个模块设计和代码审查都必须以此为标准。

### 10.1 S — 单一职责原则 (Single Responsibility)

> 一个类/模块只应有一个引起变化的原因。

```typescript
// ✅ 好的：每个服务只负责一件事
export class DiaryService { /* 日记 CRUD 业务逻辑 */ }
export class DiaryExportService { /* 日记导出为文件 */ }
export class DiarySearchService { /* 日记搜索 */ }

// ❌ 坏的：一个类包揽所有
export class DiaryManager {
  create() { ... }
  export() { ... }
  search() { ... }
  sendNotification() { ... }
  syncToCloud() { ... }
}
```

### 10.2 O — 开闭原则 (Open/Closed)

> 对扩展开放，对修改关闭。新增功能不应修改已有代码。

```typescript
// ✅ 好的：通过注册新 Provider 扩展，不修改核心逻辑
export interface AIProvider {
  chat(messages: Message[]): AsyncIterable<StreamEvent>;
}

export class ProviderRegistry {
  register(id: string, provider: AIProvider): void;
  get(id: string): AIProvider;
}

// 新增供应商 = 新增一个实现，不修改 Registry
class DeepSeekProvider implements AIProvider { ... }
registry.register('deepseek', new DeepSeekProvider());
```

### 10.3 L — 里氏替换原则 (Liskov Substitution)

> 子类型必须能透明替换父类型，不破坏程序正确性。

```typescript
// ✅ 好的：所有 Repository 实现可互换
interface DiaryRepository {
  findById(id: number): Promise<Diary | null>;
}

class SqliteDiaryRepository implements DiaryRepository { ... }
class InMemoryDiaryRepository implements DiaryRepository { ... } // 测试用

// 两者可以无差别注入到 DiaryService
```

### 10.4 I — 接口隔离原则 (Interface Segregation)

> 不应强迫依赖方依赖它不需要的接口。

```typescript
// ✅ 好的：小而专的接口
export interface Readable<T> {
  findById(id: number): Promise<T | null>;
  findAll(): Promise<T[]>;
}

export interface Writable<T> {
  create(input: CreateInput<T>): Promise<T>;
  update(id: number, input: UpdateInput<T>): Promise<T>;
  delete(id: number): Promise<void>;
}

export interface Searchable<T> {
  search(query: string, options?: SearchOptions): Promise<T[]>;
}

// 只需要读取能力的消费者，只依赖 Readable
export class SummaryGenerator {
  constructor(private readonly diaryReader: Readable<Diary>) {}
}

// ❌ 坏的：一个巨大的全能接口
export interface DiaryRepository {
  findById(...): ...;
  findAll(...): ...;
  create(...): ...;
  update(...): ...;
  delete(...): ...;
  search(...): ...;
  export(...): ...;
  importFromLegacy(...): ...;
}
```

### 10.5 D — 依赖倒置原则 (Dependency Inversion)

> 高层模块不依赖低层模块，两者都依赖抽象。

```typescript
// ✅ 好的：Service 依赖接口，不依赖具体实现
export class DiaryService {
  constructor(
    private readonly repo: DiaryRepository, // 接口
    private readonly fileService: FileService, // 接口
  ) {}
}

// 在组合根（Composition Root）中注入具体实现
const diaryService = new DiaryService(
  new SqliteDiaryRepository(db),
  new LocalFileService(basePath),
);

// ❌ 坏的：直接依赖具体实现
import { SqliteDiaryRepository } from "../database/sqlite-diary-repo";
export class DiaryService {
  private repo = new SqliteDiaryRepository(); // 硬编码依赖
}
```

### 10.6 SOLID 违规视为代码缺陷

在 Code Review 中，SOLID 违规与 Bug 同等对待：

- 一个类超过 300 行 → 疑似违反 SRP，需要拆分
- 添加新功能需要修改已有 switch/if-else 链 → 违反 OCP
- 接口超过 7 个方法 → 疑似违反 ISP，需要拆分
- import 具体实现而非接口 → 违反 DIP

---

## 十一、并行工作与 Worktree 策略

- 不同 AI 协作者可以**同时**在不同 worktree 上工作
- 工作范围**不得重叠**（通过 SCOPE.md 确保）
- 如果发现冲突，必须**立即停止**并报告
- 合并顺序由人类（项目维护者）决定
- Worktree 命名：`../BaiShou-Next-<简称>`

---

## 十二、完成检查清单

每个 AI 协作者在声称 "任务完成" 前，必须逐项确认：

### 工作准备

- [ ] 已创建 Git Worktree
- [ ] 已创建 SCOPE.md 并声明工作范围
- [ ] 已确认不与其他并行工作冲突

### 调研

- [ ] 已搜索项目内是否有类似实现
- [ ] 已搜索 npm 生态是否有成熟方案
- [ ] 调研结论已记录在 SCOPE.md
- [ ] 未重复造轮子

### 规格设计 (SDD)

- [ ] 已定义所有接口/类型
- [ ] 已编写 JSDoc 文档
- [ ] 已列举错误场景
- [ ] 已获得用户审批

### SOLID 原则

- [ ] 类/模块职责单一（SRP）
- [ ] 新功能通过扩展而非修改实现（OCP）
- [ ] 依赖注入接口而非具体实现（DIP）
- [ ] 接口小而专（ISP）

### 测试驱动 (TDD)

- [ ] 测试先于实现编写
- [ ] 覆盖正常路径
- [ ] 覆盖边界值
- [ ] 覆盖错误路径
- [ ] 测试命名清晰

### 自测验证

- [ ] `pnpm typecheck` 通过（0 errors）
- [ ] `pnpm lint` 通过（0 warnings）
- [ ] `pnpm test` 通过（全部）
- [ ] 覆盖率达标
- [ ] 已输出自测报告

### 提交合并

- [ ] Commit message 符合 Conventional Commits
- [ ] 未超出声明范围
- [ ] 代码风格一致

---

## 附录：常用命令速查

```bash
# ── Worktree ──
git worktree add ../<dir> -b <branch>       # 创建 worktree
git worktree list                           # 查看所有 worktree
git worktree remove ../<dir>                # 删除 worktree

# ── 开发 ──
pnpm dev:desktop                            # 启动桌面端开发
pnpm dev:mobile                             # 启动移动端开发

# ── 测试 ──
pnpm test                                   # 运行全部测试
pnpm test --filter=@baishou/core            # 运行指定包测试
pnpm test --coverage                        # 带覆盖率报告
pnpm test -- --watch                        # 监听模式

# ── 代码质量 ──
pnpm typecheck                              # TypeScript 类型检查
pnpm lint                                   # Lint 检查
pnpm lint --fix                             # Lint 自动修复
pnpm format                                 # 代码格式化

# ── 数据库 ──
pnpm db:generate                            # 生成迁移文件
pnpm db:push                                # 推送 schema 变更

# ── 构建 ──
pnpm build:desktop                          # 构建桌面端
pnpm build:mobile                           # 构建移动端
```

---

> **最后提醒：这份规范不是建议，是强制要求。遵守规范是对项目和团队负责的体现。**
> 如有疑问，请先阅读本文档再行动。
