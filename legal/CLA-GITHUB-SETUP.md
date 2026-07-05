# CLA 自动签署：GitHub 配置指南

贡献者通过 **[CLA Assistant](https://cla-assistant.io/)** 在 PR 里**点一下授权**。组织级协议 **一次签署、多仓通用**（见 [CLA-organization.md](./CLA-organization.md)）。

## 贡献者体验

1. 向任一覆盖仓库提交代码 PR
2. 点击 **cla-assistant** 评论中的 **Sign in with GitHub to agree**
3. 阅读 [组织级 CLA](./CLA-organization.md)，点 **I agree**
4. 同一 GitHub 账号向**其他覆盖仓库**提 PR 时，通常无需重复签署

**覆盖仓库（当前）**：

| 仓库 | PR 目标分支（参考） |
|------|---------------------|
| `foxletters-hq/BaiShou-Next` | `Baishou-dev` |
| `foxletters-hq/BaiShou-website` | `main` |

---

## 维护者配置：每个仓库 Link 一次，共用同一份 Gist

> 须由 **foxletters-hq** 组织管理员在 GitHub 网页完成。

### 第 1 步：准备组织级 CLA 的 Gist

1. 将 [CLA-organization.md](./CLA-organization.md) **全文**复制到 [gist.github.com](https://gist.github.com)
2. 文件名建议 `CLA-organization.md`，可见性 **Public**
3. 保存后复制 Gist URL（例如 `https://gist.github.com/你的用户名/xxxxxxxx`）

### 第 2 步：登录并授权

1. 打开 **https://cla-assistant.io** → **Sign in with GitHub**
2. 对组织 **foxletters-hq** 点 **Grant**

### 第 3 步：为每个覆盖仓库 Link（重复本步）

对每个仓库执行 **Configure CLA**：

| 字段 | 填写 |
|------|------|
| Repository | `foxletters-hq/BaiShou-Next`，然后对 `foxletters-hq/BaiShou-website` 再 Link 一次 |
| CLA document | **同一个 Gist URL**（上一步复制的链接） |
| Minimum file changes | `1` |

点 **Link** → **Yes, let's do this!** → 授权 Gist + Webhook。

两个仓库可共用**同一份签署记录 Gist**（cla-assistant 按 GitHub 用户维度记录，跨仓生效）。

### 第 4 步：白名单（可选）

维护者账号、`dependabot[bot]`、`github-actions[bot]` 等。

### 第 5 步：验证

分别向 `BaiShou-Next`（→ `Baishou-dev`）和 `BaiShou-website`（→ `main`）提测试 PR，确认 CLA 评论与签署流程。

---

## 仓库直链（备选，不用 Gist 时）

```
https://github.com/foxletters-hq/BaiShou-Next/blob/main/legal/CLA-organization.md
```

官网仓库无 `legal/` 目录时，**建议统一用 Gist 或始终指向 BaiShou-Next 上的协议文件**（两个仓库填同一 URL 即可）。

---

## 常见问题

**Q：签一次就够吗？**  
A：对。组织级 CLA 设计为同一 GitHub 用户在 foxletters-hq 下已 Link 的仓库通用（cla-assistant 侧记录）。

**Q：新增仓库怎么办？**  
A：在 cla-assistant 为新仓库 Link 同一 Gist，并在该仓库 `README` / `.github/CLA.md` 注明适用本协议即可，**一般无需改 CLA 正文**。

**Q：企业贡献？**  
A：另签 [CLA-corporate.md](./CLA-corporate.md)。

---

## 相关链接

- [组织级个人 CLA](./CLA-organization.md)
- [企业 CLA](./CLA-corporate.md)
- [CLA Assistant](https://cla-assistant.io/)
- [贡献指南（BaiShou-Next）](../docs/2-Submit/2-Contributing-Guide.md)
