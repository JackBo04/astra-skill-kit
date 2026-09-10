# 升级到 SelfGuide 命名

v0.3.0 将当前名称统一为 SelfGuide。升级沿用原 ChatGPT 项目 ID、会话、登录资料和配对信息。

| 用途 | 新名称 | 旧名称（兼容来源） |
| --- | --- | --- |
| ChatGPT 项目 | `selfguide` | `astra` |
| 服务器 skill | `$selfguide-server` | `$chatgpt-supervised-server` |
| 本地浏览器 skill | `$selfguide-local` | `$chatgpt-supervised-local` |
| 原单机部署 skill | `$selfguide` | `$chatgpt-supervised-work` |
| 新任务默认目录 | `<工作区>/selfguide/tasks/` | `<工作区>/astra/tasks/` |
| 服务器浏览器目录 | `~/.local/share/selfguide-browser/` | `~/.local/share/codex-chatgpt-browser/` |
| 项目配置文件 | `run/selfguide-project.json` | `run/astra-project.json` |
| 本地桥接目录 | `~/.local/share/selfguide-local-bridge/` | `~/.local/share/astra-local-bridge/` |

## 交给 Agent 的升级指令

```text
请将现有安装升级到 https://github.com/JackBo04/selfguide 的 v0.3.0。
先读取 docs/migration.md，确认当前使用 server 还是 local。
复用现有项目、登录、配对和任务记录，将显示名称、调用名与配置迁移到 selfguide。
普通检查和可逆迁移直接执行；完成后报告新调用方式和迁移验证结果。
```

## 迁移顺序

1. 检查安装路径、运行服务和任务状态，记录原路径。旧配置有凭据，不输出或提交配置内容。
2. 在已登录网页中将原项目重命名为 `selfguide`，保留项目 ID 和会话。不要新建同名项目替代原项目。网页名称可能改变 URL 中的可选 slug，实际输入前重新读取地址。
3. 按 `tools/install.py` 安装对应新 skill。先核对旧版用户定制；将旧 skill 移到发现目录以外备份，再用旧路径到新版的符号链接保留脚本兼容，避免运行两份不同的实现。原自定义单机部署可将 skill 改为 `selfguide`，保留旧路径别名。
4. 浏览器继续使用原登录目录。新版优先采用 `SELFGUIDE_BROWSER_HOME`，兼容 `CHATGPT_BROWSER_HOME`；未指定时优先新目录，新目录不存在则复用旧目录。可创建新目录名到原运行目录的符号链接，让现有进程继续运行，勿复制或清空 profile。
5. 项目配置改名为 `selfguide-project.json`，将 `name` 更新为 `selfguide`，保留原项目 URL／ID；旧配置名可链接到新文件。新版也能直接读取旧文件名。不要改写历史消息原文、证据摘要或对话 ID。
6. 任务目录可迁移到 `<工作区>/selfguide/`，保留旧目录名的符号链接。若该路径已是源码仓库或其他目录，使用明确的独立目录（例如 `selfguide-workspace/`），同步 skill 中的 `--workspace` 说明，不覆盖既有文件。状态文件的项目标签可在持有 `.state.lock` 时更新；保持轮次和发送状态。
7. 本地桥接优先采用 `SELFGUIDE_LOCAL_HOME`，兼容 `ASTRA_LOCAL_HOME`，默认目录同样先新后旧。复用原配对信息；更新扩展后重新加载扩展和绑定标签页，使内容脚本与后台使用同版消息名。有未确认发送时先解决原操作，再刷新。
8. 核对浏览器仍已登录、旧任务能恢复、新建记录使用新名称。网页改名后 `session.py sent` 允许同一项目 ID、同一会话 ID 的 slug 变化，仍拒绝切换任务会话。

`SELFGUIDE_CHROME`、`SELFGUIDE_XVFB` 和 `SELFGUIDE_ALLOW_NO_SANDBOX` 替代旧的 `ASTRA_*` 对应变量，运行时仍可读取旧变量。新命名不是重新登录或重新配对的理由。
