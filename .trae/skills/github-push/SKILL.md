---
name: "github-push"
description: "Pushes local code to the city-survival-guide GitHub repository. Invoke when user wants to push/upload/update code to GitHub, commit changes, or sync the repository."
---

# GitHub Push (city-survival-guide)

将本地代码推送到 city-survival-guide GitHub 仓库。

## 仓库信息

| 项目 | 值 |
|------|-----|
| 仓库地址 | `git@github.com:hou720616/city-survival-guide.git` |
| SSH 密钥路径 | `C:\Users\www13\.ssh\id_ed25519` |
| 默认分支 | `master` |

## 工作流程

### 阶段 1：检查 SSH 密钥和 Git 状态

```powershell
# 1. 确认密钥存在
Test-Path "C:\Users\www13\.ssh\id_ed25519"

# 2. 检查当前 git 状态
git -c core.sshCommand="ssh -i C:\Users\www13\.ssh\id_ed25519 -o StrictHostKeyChecking=no" status

# 3. 检查当前分支
git -c core.sshCommand="ssh -i C:\Users\www13\.ssh\id_ed25519 -o StrictHostKeyChecking=no" branch -vv

# 4. 检查远程仓库
git -c core.sshCommand="ssh -i C:\Users\www13\.ssh\id_ed25519 -o StrictHostKeyChecking=no" remote -v
```

### 阶段 2：查看变更

```powershell
# 查看变更的文件
git -c core.sshCommand="ssh -i C:\Users\www13\.ssh\id_ed25519 -o StrictHostKeyChecking=no" diff --name-status
```

### 阶段 3：提交并推送

**提交步骤**：

1. 如果有未跟踪的文件需要提交，用 `git add` 选择性添加（不要用 `git add -A` 或 `git add .`，避免误加敏感文件）
2. 排除必须忽略的文件：
   - `.env`（含 API Key）
   - `api/data/`（数据库）
   - `node_modules/`、`dist/`
   - `*.tar.gz`、`*.pyc`、`logs/`、`__pycache__/`
   - `.trae/` 目录下的 IDE 内部配置

3. 提交信息格式：
   ```
   <type>: <简短描述>
   ```
   type 取值：`feat`、`fix`、`refactor`、`chore`、`docs`、`style`

4. 推送：
   ```powershell
   git -c core.sshCommand="ssh -i C:\Users\www13\.ssh\id_ed25519 -o StrictHostKeyChecking=no" push -u origin master
   ```

### 阶段 4：验证

推送成功后，输出提交的 commit hash 和变更摘要。

## 注意事项

- **绝对禁用**：`git push --force`、`git push --force-with-lease`、`git reset --hard`
- **绝对禁用**：`git add -A` 或 `git add .`，必须逐个文件添加
- **绝对禁用**：提交 `.env`、`api/data/*.db` 等敏感/数据文件
- **绝对禁用**：修改 git config
- 所有 git 操作必须通过 `GIT_SSH_COMMAND` 或 `-c core.sshCommand` 指定 SSH 密钥
- 如果远程仓库已有更新，先用 `git pull --rebase` 拉取再推送
- 工作目录：项目根目录 `g:\PyProject\TraeDemo\CSGProject`
