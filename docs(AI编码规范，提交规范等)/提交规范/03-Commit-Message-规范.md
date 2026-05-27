# Commit Message 规范

## 格式

```
<type>(<scope>): <简短说明>

[可选正文]
```

- **type**：见下表
- **scope**：可选，如 `desktop`、`ui-web`、`database`、`ci`
- **说明**：中文或英文均可，一句说清「为什么」

## type 含义

| type       | 用途                   |
| ---------- | ---------------------- |
| `feat`     | 新功能                 |
| `fix`      | 缺陷修复               |
| `refactor` | 重构（不改变外部行为） |
| `chore`    | 工具链、配置、依赖     |
| `test`     | 测试新增或修正         |
| `docs`     | 仅文档                 |
| `style`    | 格式化、无逻辑变更     |

## 示例

```
chore: 添加 CI、VS Code 与 ESLint 共享配置

refactor(ui-web): 拆分 CloudSyncPanel 以符合 300 行规范

fix(ai): 修正 provider 单测与 generateText mock

test: 本地跳过 better-sqlite3 不可用时的集成测
```

## 提交粒度建议

- 单 commit 避免「整仓格式化 + 功能」混在一起
- 超大重构可拆成：`chore(ci)` → `refactor(database)` → `refactor(ui-web)` → `refactor(desktop)`
- 不要提交临时脚本；不要 `git push --force` 到 `main` 除非团队明确约定

## 与规范文档的关系

结构与安全相关约束见 [Vibe-Coding-Spec.md](../AI编码规范/Vibe-Coding-Spec.md)；推送前检查见 [01-提交前检查清单.md](./01-提交前检查清单.md)。
