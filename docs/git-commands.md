# Git 常用命令参考

> 整理于 2026-04-03 · 涵盖日常开发、分支管理、远程协作、历史追溯、Worktree 等场景

---

## 目录

1. [初始化与配置](#一初始化与配置)
2. [基础操作](#二基础操作)
3. [分支管理](#三分支管理)
4. [远程仓库](#四远程仓库)
5. [合并与变基](#五合并与变基)
6. [撤销与回退](#六撤销与回退)
7. [暂存区 (Stash)](#七暂存区-stash)
8. [标签 (Tag)](#八标签-tag)
9. [历史查看与追溯](#九历史查看与追溯)
10. [Worktree](#十worktree)
11. [子模块 (Submodule)](#十一子模块-submodule)
12. [实用技巧](#十二实用技巧)

---

## 一、初始化与配置

```bash
# 初始化仓库
git init

# 克隆远程仓库
git clone <url>
git clone <url> <目录名>          # 克隆到指定目录
git clone --depth 1 <url>         # 浅克隆，只取最近一次提交

# 全局配置
git config --global user.name "Anson"
git config --global user.email "your@email.com"
git config --global core.editor "vim"
git config --global init.defaultBranch main

# 查看配置
git config --list                 # 查看所有配置
git config user.name             # 查看某一项
```

---

## 二、基础操作

### 状态与暂存

```bash
git status                        # 查看工作区状态
git status -s                     # 简洁格式

git add <file>                    # 暂存指定文件
git add .                         # 暂存所有修改
git add -p                        # 交互式分块暂存（非常推荐！）

git diff                          # 查看未暂存的修改
git diff --staged                 # 查看已暂存的修改
```

### 提交

```bash
git commit -m "feat: 添加用户登录功能"
git commit -am "fix: 修复空指针"     # 跳过 add，直接提交已追踪文件
git commit --amend                    # 修改最近一次提交（消息或内容）
git commit --amend --no-edit          # 仅追加内容，不改提交信息
```

### 删除与移动

```bash
git rm <file>                    # 删除文件并暂存删除操作
git rm --cached <file>           # 仅从 Git 中移除，保留本地文件
git mv <old> <new>               # 重命名/移动文件
```

---

## 三、分支管理

```bash
# 查看分支
git branch                       # 本地分支
git branch -a                    # 所有分支（含远程）
git branch -v                    # 显示最近提交信息

# 创建分支
git branch <name>                # 创建分支（不切换）
git checkout -b <name>           # 创建并切换
git switch -c <name>             # 同上（推荐新语法）

# 切换分支
git checkout <name>
git switch <name>                # 推荐新语法

# 删除分支
git branch -d <name>             # 安全删除（已合并才能删）
git branch -D <name>             # 强制删除

# 重命名分支
git branch -m <old> <new>
git branch -M main               # 将当前分支重命名为 main
```

---

## 四、远程仓库

```bash
# 查看远程
git remote -v
git remote show origin

# 添加 / 修改远程
git remote add origin <url>
git remote set-url origin <new-url>
git remote rename origin upstream

# 推送
git push origin <branch>
git push -u origin <branch>      # 推送并设置上游跟踪
git push --force-with-lease      # 安全强推（推荐替代 --force）
git push origin --delete <branch> # 删除远程分支

# 拉取
git fetch origin                 # 只拉取，不合并
git fetch --all                  # 拉取所有远程
git pull                         # fetch + merge
git pull --rebase                # fetch + rebase（保持线性历史）
```

---

## 五、合并与变基

### Merge

```bash
git merge <branch>               # 合并到当前分支
git merge --no-ff <branch>       # 禁止快进，强制生成 merge commit
git merge --squash <branch>      # 压缩所有提交为一个（需手动 commit）
git merge --abort                # 放弃合并
```

### Rebase

```bash
git rebase main                  # 将当前分支变基到 main
git rebase -i HEAD~3             # 交互式变基，整理最近 3 个提交
git rebase --continue            # 解决冲突后继续
git rebase --abort               # 放弃变基
git rebase --skip                # 跳过当前提交（慎用）
```

### Cherry-pick

```bash
git cherry-pick <commit>         # 挑取某个提交到当前分支
git cherry-pick <A>..<B>         # 挑取一段范围的提交
git cherry-pick --no-commit      # 仅应用变更，不自动提交
git cherry-pick --abort
```

---

## 六、撤销与回退

```bash
# 撤销工作区修改（慎用，不可恢复）
git checkout -- <file>
git restore <file>               # 推荐新语法

# 撤销暂存区（退回到工作区）
git reset HEAD <file>
git restore --staged <file>      # 推荐新语法

# 回退提交（保留工作区）
git reset --soft HEAD~1          # 撤销提交，保留暂存
git reset --mixed HEAD~1         # 撤销提交，保留工作区（默认）
git reset --hard HEAD~1          # 撤销提交，丢弃所有修改（危险！）

# 反向提交（生成新 commit 来撤销，适合公共分支）
git revert <commit>
git revert HEAD                  # 撤销最新一个提交
git revert --no-commit <commit>  # 只应用反向变更，不自动提交
```

---

## 七、暂存区 (Stash)

```bash
git stash                        # 暂存当前所有修改
git stash push -m "描述信息"     # 带描述暂存
git stash -u                     # 同时暂存未追踪文件

git stash list                   # 查看所有 stash
git stash show stash@{0}         # 查看第一条 stash 的摘要
git stash show -p stash@{0}      # 查看详细 diff

git stash pop                    # 应用最近一条并删除
git stash apply stash@{1}        # 应用指定 stash（不删除）
git stash drop stash@{0}         # 删除指定 stash
git stash clear                  # 清空所有 stash

git stash branch <name> stash@{0}  # 从 stash 创建新分支
```

---

## 八、标签 (Tag)

```bash
# 创建标签
git tag v1.0.0                          # 轻量标签
git tag -a v1.0.0 -m "正式发布 v1.0.0"  # 附注标签（推荐）
git tag -a v1.0.0 <commit>              # 对历史提交打标签

# 查看标签
git tag
git tag -l "v1.*"                # 过滤匹配
git show v1.0.0

# 推送标签
git push origin v1.0.0           # 推送单个
git push origin --tags           # 推送所有本地标签

# 删除标签
git tag -d v1.0.0                # 删除本地
git push origin --delete v1.0.0  # 删除远程
```

---

## 九、历史查看与追溯

```bash
# 日志
git log
git log --oneline                        # 单行简洁
git log --oneline --graph --all          # 图形化所有分支（非常好用）
git log -n 10                            # 最近 10 条
git log --author="Anson"                 # 过滤作者
git log --since="2026-01-01"             # 时间过滤
git log --grep="fix"                     # 过滤提交信息
git log -S "functionName"               # 搜索增删了特定字符串的提交
git log -- <file>                        # 查看某个文件的提交历史

# 追溯
git blame <file>                         # 查看每行代码的最后修改者
git blame -L 10,20 <file>               # 只看第 10-20 行

# 二分查找 bug
git bisect start
git bisect bad                           # 标记当前是 bad
git bisect good <commit>                 # 标记某个已知的 good
# Git 会自动 checkout 中间版本，手动测试后继续标记...
git bisect good / git bisect bad
git bisect reset                         # 结束查找

# 引用日志（找回丢失的提交！）
git reflog
git reflog show <branch>
```

---

## 十、Worktree

`git worktree` 允许在同一个仓库中同时检出多个分支到不同目录，无需切换分支，非常适合同时修复 bug 和开发新功能。

```bash
# 查看当前所有 worktree
git worktree list

# 添加 worktree（在新目录检出已有分支）
git worktree add ../baishou-hotfix hotfix/login-crash

# 添加 worktree（同时创建新分支）
git worktree add -b feature/new-ui ../baishou-new-ui main

# 添加 worktree（detached HEAD，检出某个 commit）
git worktree add --detach ../baishou-inspect <commit>

# 删除 worktree
git worktree remove ../baishou-hotfix       # 目录为空时可直接删
git worktree remove --force ../baishou-hotfix  # 强制删除

# 清理失效的 worktree 记录（目录被手动删除后）
git worktree prune
```

### 典型使用场景

```
项目根目录/
  BaiShou-Next/          ← 主 worktree（main 分支，日常开发）
  BaiShou-Next-hotfix/   ← 临时 worktree（hotfix 分支，紧急修复）
  BaiShou-Next-review/   ← 临时 worktree（PR review 分支）
```

```bash
# 创建 hotfix worktree
git worktree add -b hotfix/v2.1.1 ../BaiShou-Next-hotfix main

# 在另一个终端进入该目录工作
cd ../BaiShou-Next-hotfix
# ... 修改、提交、推送 ...

# 工作完成后回到主目录删除 worktree
cd ../BaiShou-Next
git worktree remove ../BaiShou-Next-hotfix
```

> **注意：** 同一个分支不能同时被两个 worktree 检出，会报错。

---

## 十一、子模块 (Submodule)

```bash
# 添加子模块
git submodule add <url> <路径>

# 克隆含子模块的仓库
git clone --recurse-submodules <url>

# 初始化并更新子模块（克隆后忘了加参数时）
git submodule update --init --recursive

# 更新子模块到最新
git submodule update --remote

# 查看子模块状态
git submodule status
```

---

## 十二、实用技巧

### 别名配置（推荐写入 ~/.gitconfig）

```bash
git config --global alias.lg "log --oneline --graph --all --decorate"
git config --global alias.st "status -s"
git config --global alias.cm "commit -m"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.wt "worktree"
```

### 忽略文件

```bash
# 查看哪条规则忽略了文件
git check-ignore -v <file>

# 强制添加被忽略的文件
git add -f <file>
```

### 清理工作区

```bash
git clean -n                     # 预览将要删除的文件（dry run）
git clean -fd                    # 删除未追踪的文件和目录
git clean -fdx                   # 同上，还删除被 .gitignore 忽略的文件
```

### 统计贡献

```bash
git shortlog -sn                 # 按提交数统计贡献者
git diff --stat HEAD~10 HEAD     # 最近 10 次提交的文件变更统计
```

### 找回丢失的提交

```bash
# 强制 reset 或误删分支后，用 reflog 找回
git reflog
git checkout -b recover-branch <丢失的commit-hash>
```

---

*文档持续更新中，如有遗漏欢迎补充。*
