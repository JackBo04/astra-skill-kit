# Astra · 让自己的 ChatGPT 指导 Codex 干活

给 Codex 一个任务，让自己账户的网页版 ChatGPT 提建议、解答执行问题、评审实际结果。Codex 在你连接的服务器上执行、验证、上传材料并反馈，按建议继续推进，直到达到任务的验收标准。

**两个版本都在服务器执行任务，只是浏览器的位置不同。** 每个新任务在网页版 **astra** 项目中建立专用会话，后续提问与反馈沿用原会话；服务器保存材料、完整收发、结果和恢复记录。

## 分工与网页版档位

**网页版是主要指导者，Codex 是执行者。** 网页版决定总体方案、关键步骤和验收；它缺少信息时直接向 Codex 提出需求。Codex 从实际文件、日志和环境取证，按问题补充材料，执行步骤并把真实结果送回评审。可从环境取得的信息由 Codex 自行处理，只有用户独有的信息或决策才询问你。

- **网页版默认 xhigh（当前页面显示 Extra High）档位。**
- Codex 判断问题明显困难、涉及关键复杂推理，或补足证据后多轮仍无进展时，选择**网页版 Pro 档位**；普通工作继续 xhigh。这个判断不需要你每次确认。
- 这里说的是**网页版档位**，不改变 Codex 自身的模型或推理档位，也不表示购买或升级 Pro 订阅。操作后核对网页实际状态。
- 服务器版可通过可见桌面操作档位。本地扩展当前尚无档位切换命令，需在本地网页设好 xhigh；需要 Pro 且没有本地操作工具时，由用户切换。规则已配置不等于本地自动切档已经实现。

详细规则和交接模板见 [网页主导与档位规则](https://github.com/JackBo04/astra-skill-kit/blob/main/skills/chatgpt-supervised-server/references/leadership.md)。

## 选哪个版本

| 版本 | ChatGPT 浏览器在哪里 | 适用场景 | Codex 调用名称 |
| --- | --- | --- | --- |
| 服务器浏览器版 | 服务器普通 Chrome，你通过远程画面操作 | 继续使用已经登录的服务器浏览器 | `$chatgpt-supervised-server` |
| 本地浏览器版 | 自己电脑上的 Chrome／Edge | 希望复用本地浏览器登录，通过 SSH 与服务器互通 | `$chatgpt-supervised-local` |

服务器方案已经完成真实 ChatGPT 的附件上传、指导执行、结果回传和验收。本地版已通过真实浏览器扩展与模拟页面的联调，**还需在你的电脑和真实 ChatGPT 页面完成首次验收**。详见 [验证记录](docs/validation.md)。

## 复制给 Agent，一条指令开始安装

在**已经连接目标服务器的 Codex／Agent 会话**中，复制以下任意一段。Agent 会按 [Agent 安装规范](docs/agent-install.md) 检查环境、安装对应 skill、完成可执行的配置并验证。

### 安装服务器浏览器版

```text
请在你当前连接的服务器上安装并配置 https://github.com/JackBo04/astra-skill-kit 的服务器浏览器版。先读取仓库 README.md 和 docs/agent-install.md，再按其中 server 流程执行。复用已有 astra 项目、浏览器和登录状态，完成可自动执行的安装与检查，并用合成附件验证“上传→网页指导→本地执行→结果回传→验收”。普通安装和可逆修复直接处理；只有缺少必要信息、需要我登录或确实需要我决定时再问我。最后给我安装位置、验证结果和后续任务调用示例。
```

### 安装本地浏览器版

```text
请在你当前连接的服务器上安装并配置 https://github.com/JackBo04/astra-skill-kit 的本地浏览器版。先读取仓库 README.md 和 docs/agent-install.md，再按其中 local 流程执行。Codex 仍在服务器干活，ChatGPT 浏览器使用我自己电脑上的 Chrome／Edge。先完成服务器端安装和配置，再一次性给我本地扩展下载入口、SSH 转发命令和配对步骤；连接后用合成附件完成两轮真实验收。普通安装和可逆修复直接处理，仅在缺少必要信息或需要我在本机操作时再问我。不要把服务器端安装完成当成本地浏览器已经连接成功。
```

“给 Agent 一条指令”表示让它接手安装流程。初次登录、人机验证，以及本地电脑上的扩展安装和配对，仍需你亲自操作。后续任务复用已有登录，是否需要重新验证由网站决定。

### 获取源码

本仓库采用 [MIT License](LICENSE) 开源，读取和下载无需 GitHub 登录：

```bash
git clone https://github.com/JackBo04/astra-skill-kit.git
```

Agent 可直接读取公开链接，或下载后读取本地说明。浏览器登录资料、配对码、聊天记录和研究材料留在各自运行环境中。

## 自己在终端安装

[下载发布包](https://github.com/JackBo04/astra-skill-kit/releases)，在服务器解压、进入包目录后执行对应命令：

```bash
# 服务器浏览器版
python3 tools/install.py server

# 本地浏览器版
python3 tools/install.py local
```

安装器默认放到 `~/.agents/skills/`，遇到同名目录会停止，保护原有安装。安装后开一个新的 Codex 会话，以便发现新增 skill。

如果服务器已安装 Git 和 Python，且当前目录下没有同名仓库，也可直接使用下面的一行命令下载并安装 skill：

```bash
# 服务器浏览器版
git clone https://github.com/JackBo04/astra-skill-kit.git && python3 astra-skill-kit/tools/install.py server

# 本地浏览器版（二选一执行）
git clone https://github.com/JackBo04/astra-skill-kit.git && python3 astra-skill-kit/tools/install.py local
```

这些终端命令只完成 **skill 安装**。浏览器服务、项目配置、本地扩展及登录的步骤见对应指南；上面的 Agent 指令会继续处理这些步骤。

- [服务器浏览器版：依赖、配置、远程登录和恢复](docs/server-browser.md)
- [本地浏览器版：服务器配置、SSH、扩展与配对](docs/local-browser.md)

## 安装后怎么给任务

在连接服务器的 Codex 新会话中说：

```text
使用 $chatgpt-supervised-server。
请让 astra 网页版指导你完成：<任务>。
材料在：<服务器文件路径>。
验收标准：<怎样算完成>。
按反馈继续执行并提交实际结果，只有确实需要我做决定时才问我。
```

本地浏览器版把第一行换成 `$chatgpt-supervised-local`。每轮收发由 Codex 按 skill 处理，不需要你手动搬运消息。网页版的建议受原任务范围约束，Codex 仍需核对现场事实和独立验证。

服务器文件可直接给路径，也可放在当前工作区 `astra/inbox/` 后说明任务。放入文件本身不会自动上传；Codex 只选择任务所需材料。电脑本地的材料先放到服务器可访问的位置。

## 文件保存在什么地方

```text
当前工作区/astra/
├── inbox/                    候选材料，可按需建立
└── tasks/<任务 ID>/
    ├── task.txt              目标与验收要求
    ├── state.json            进度、轮次与网页会话地址
    ├── uploads/              选定附件副本及来源校验清单
    ├── messages/             发给网页版的说明
    ├── feedback/             网页版完整回复
    ├── outputs/              执行生成的结果
    └── checks/               验证证据与恢复记录
```

原研究文件留在原处。浏览器登录状态与任务材料分开存放，不打入安装包，也不上传到 GitHub。

## 运行条件与常见问题

- **要反复登录吗？** 默认保留并复用浏览器登录；网站使会话失效或要求验证时需要你处理，不能保证永不重新登录。
- **没有图形界面的服务器能用吗？** 服务器版通过 Xvfb 提供虚拟桌面；本地版的服务器桥接只需要 Python，浏览器运行在你电脑上。
- **本地电脑能关机吗？** 本地版需要电脑、浏览器和 SSH 隧道保持运行，休眠或断线后按任务记录恢复。服务器版的远程查看页面可关闭，服务器 Chrome 继续运行。
- **会重复发消息吗？** 程序保存发送状态；结果不明时应检查原记录和网页，不能直接重发。
- **文件多大都能上传吗？** 本地桥接默认单文件最多 8 MiB；这是程序限制，不是网站官方上限。大材料先提取相关样本、摘要或图表，实际上传以网页结果为准。
- **安装后会自动启动 Codex 吗？** 不会。需要在运行中的 Codex 会话给出任务，桥接服务只负责协助收发。

## 开发与验证

以下命令在完整仓库源码中运行。Python 3.10+；服务器浏览器服务需要 Node.js 20+，系统桌面依赖见对应指南。本地版的 Python 桥接仅使用标准库，扩展无需编译。

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm ci
npx playwright install chromium
node tests/test_extension.mjs
python3 tools/package.py
```

打包生成两个 ZIP 和 `dist/SHA256SUMS`，只收集列出的源码和说明目录。扩展测试使用模拟页面，不能代替实际账户的首次验收。

参考：[OpenAI 官方 skill 文档](https://developers.openai.com/codex/skills)、Chrome 扩展的 [消息传递](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) 与 [网络请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)。

## 开源许可

采用 [MIT License](LICENSE)，允许使用、修改和分发，需保留许可证与版权声明。依赖软件按各自许可证分发。
