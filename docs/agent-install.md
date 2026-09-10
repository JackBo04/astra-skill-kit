# 给 Agent 的安装规范

适用于用户要求安装本仓库的 `server` 或 `local` 版本。先完成当前服务器可执行的工作，再请求确需用户完成的本地操作；只报告有证据支持的安装和连接状态。本文是安装流程，不授权执行用户尚未指定的研究任务。

已有旧版安装时先读取 [命名迁移](migration.md)，复用已有项目、配对和登录目录。

## 1. 确认目标、获取代码

用户选择的版本已经明确时直接执行；本地版和服务器版的 Codex 都运行在当前连接的服务器上。没有明确版本时检查用户上下文和现有浏览器部署，无法判断才问一次。

本仓库为公开的 MIT 开源仓库。直接使用 `git clone https://github.com/JackBo04/selfguide.git <目标目录>` 下载，无需用户提供 GitHub 授权。已存在的正确仓库先检查工作树，不覆盖用户修改，不强制重置；记录所用提交。用户提供发行包时也可从解压目录安装。

读取本仓库 README、本文、所选 `docs/server-browser.md` 或 `docs/local-browser.md`、对应 `skills/selfguide-<版本>/SKILL.md`。同时遵守当前工作区已有指令。

## 2. 安装 skill

检查服务器 Python 3.10+，选择可用的 `python3` 或 `python`。以下用 `python3` 表示。进入仓库或发行包根目录：

```bash
python3 tools/install.py server
# 或
python3 tools/install.py local
```

默认安装到 `~/.agents/skills/selfguide-<版本>`；若实际 Codex 环境需要其他发现目录，用 `--skills-dir <目录>` 指定。安装器会拒绝覆盖同名目录。已有安装时先确认来源和内容：相同版本直接复用；确需升级时备份旧 skill、保护用户定制，再执行安装。不要为了升级删除浏览器配置、会话记录或原 `selfguide`。

仓库中的运行依赖和扩展不是仅靠一个 SKILL.md 就能替代的。服务器版必须通过本仓库安装器带上 `runtime/server-browser`；本地版必须保留本地电脑需要加载的 `extension/` 下载入口。不要只复制 SKILL.md 后宣告可用。

## 3A. server：配置服务器浏览器

先检查已有部署：

```bash
python3 ~/.agents/skills/selfguide-server/scripts/browserctl.py status
```

已有服务正常运行就复用，不重启已登录 Chrome。`mode: manual-login` 表示普通 Chrome 模式，不代表尚未登录；通过可见页面确认。

没有服务时，按服务器指南检查 Chrome、Xvfb、xauth、x11vnc、xdotool、xclip、Pillow 和 Node.js，安装可在现有权限内安装的依赖。缺少管理员权限时先完成其他步骤，再说明具体缺失项。不要自动关闭 Chrome 沙箱或修改服务器权限来追求“一键成功”。

新安装需要 Node 依赖：

```bash
cd ~/.agents/skills/selfguide-server/runtime/server-browser
npm ci
```

读取已有运行目录的 `run/selfguide-project.json` 取得项目名称和 URL；没有配置时，从用户指定或当前已登录页面确认 selfguide 项目，确实无法获取才请求 URL。不要输出含密钥的整个配置文件。

```bash
python3 ~/.agents/skills/selfguide-server/scripts/browserctl.py setup --project-url '<实际selfguide项目URL>'
python3 ~/.agents/skills/selfguide-server/scripts/browserctl.py start
python3 ~/.agents/skills/selfguide-server/scripts/browserctl.py status
python3 ~/.agents/skills/selfguide-server/scripts/browserctl.py url
```

需要首次人工登录时，先准备好可访问的远程入口和实际端口转发说明，再让用户登录。保留固定登录目录，不导出 Cookie、密码或验证码。显示号或端口冲突先识别已有进程，不删锁强启。

## 3B. local：配置服务器桥接并交接本地操作

本地版桥接没有第三方 Python 依赖。检查 `SELFGUIDE_LOCAL_HOME` 或默认 `~/.local/share/selfguide-local-bridge` 的配置是否存在；已有项目和配对信息应复用，不重复 init。缺少项目 URL 时可读取原服务器浏览器的 selfguide 项目配置，只提取 URL，不迁移登录资料。

```bash
python3 ~/.agents/skills/selfguide-local/scripts/bridge.py init --project-url '<实际selfguide项目URL>'
python3 ~/.agents/skills/selfguide-local/scripts/bridge.py serve
```

服务需要持续运行，按当前服务器允许的方式保留进程和本地日志。先检查已有监听，避免重复启动；不要开放公网端口。

在服务器可执行部分完成后，一次性给用户以下信息：

1. [本地版发布包下载页](https://github.com/JackBo04/selfguide/releases)，解压后要选其中的 `extension/` 文件夹。
2. 可复制的 SSH 转发命令，使用用户实际 SSH 别名、目标地址或已知跳板配置。仅仅知道服务器主机名不代表它是用户电脑可达的地址；这项信息未知时才询问。
3. Chrome／Edge 加载扩展、打开正确 selfguide 项目并绑定当前标签页的步骤。
4. 用户在自己服务器终端运行 `bridge.py pairing` 查看配对信息的方法。配对码填扩展，不发到 ChatGPT、不写入提交或公开报告。

本地转发模板如下，必须在用户自己的电脑终端运行：

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:8765:127.0.0.1:8765 <实际SSH目标>
```

不要在 VS Code 远程终端执行这条命令后声称用户电脑的转发已建立。服务器 Agent 无法操作用户电脑时，扩展安装与配对是必须用户完成的部分；等待期间可完成服务器文件和文档检查，不声称本地端已连接。

## 网页版档位配置

按对应 skill 的 `references/leadership.md` 设置协作分工。默认核对网页版 xhigh（当前显示 Extra High）档位；困难问题可由 Codex 判断切到网页版 Pro。不要改 Codex 自身模型或推理档位，也不要把账户 Pro 订阅标签作为当前网页档位的证据。服务器版通过可见桌面控件确认；本地扩展当前没有切档命令，配对时让用户在网页选好 xhigh，并说明后续 Pro 切换的能力限制。

## 4. 首次真实验收

连接准备好后，按照安装后的 skill 操作，不自行跳过发送状态记录。在 selfguide 建一条合成测试会话：

1. 在服务器任务文件夹生成小 TXT，包含三项合成数值和随机校验码，校验码只放附件，不同时放提示文字。
2. 上传附件，确认网页卡片就绪，再让网页版读出校验码、计算结果并指导本地执行。
3. 按反馈生成 JSON 结果，重新读取原 TXT 独立验证字段。
4. 把实际 JSON 作为附件回传同一会话，读取对应的完整评审，记录验收结果。

不使用研究文件做首次联调，不批量读取用户其他聊天。登录或人机验证须由用户处理；服务额度、格式不支持、页面变化等问题要记录现场证据，不反复发送、不猜测成功。

## 5. 完成报告

报告所装版本、服务器上的安装路径、源码提交或发行版本、实际验证结果，以及一段后续任务调用示例。如果仍等待人工登录或本地配对，明确写出“服务器安装完成，等待……”，列出剩余步骤；只有真实收发和附件验收通过后才能称为完整可用。

安装后若当前 Codex 会话还没发现新 skill，提示用户开启新会话。新任务使用 `$selfguide-server` 或 `$selfguide-local`，浏览器服务本身不会自动启动 Codex。
