# Astra · ChatGPT 指导 Codex

给 Codex 一个任务，让自己账户的网页版 ChatGPT 提方案、回答执行问题、评审实际结果；Codex 在所连接的服务器上持续执行，直到满足验收标准。两个版本均把每个任务的新会话放进配置的 **astra** 项目，后续沿用该会话，并在服务器保存完整任务记录。

| 版本 | Codex 在哪里执行 | ChatGPT 浏览器在哪里 | 适用情况 |
| --- | --- | --- | --- |
| `chatgpt-supervised-server` | 你连接的服务器 | 服务器专用 Chrome，通过远程画面查看 | 保持目前已经登录的服务器浏览器方案 |
| `chatgpt-supervised-local` | 你连接的服务器 | 你电脑上的 Chrome／Edge，安装随包扩展 | 使用本地浏览器登录，通过 SSH 传递消息和附件 |

下载 [Releases](https://github.com/JackBo04/astra-skill-kit/releases) 中对应 ZIP。两个包都包含安装工具、skill 和中文说明。本地版另含浏览器扩展，服务器版另含远程桌面服务源码。浏览器程序和第三方依赖按说明安装，不在 ZIP 中分发。

- [服务器浏览器版：安装和使用](docs/server-browser.md)
- [本地浏览器版：安装和使用](docs/local-browser.md)
- [已验证范围与限制](docs/validation.md)

## 如何给任务

安装后，在连接目标服务器的 Codex 新会话中说：

```text
使用 $chatgpt-supervised-server。
请让 astra 网页版指导你完成：<任务>。
材料在：<服务器文件路径>。
验收标准：<怎样算完成>。
按它的反馈继续执行并提交实际结果，只有确实需要我做决定时才问我。
```

本地浏览器版把第一行换成 `$chatgpt-supervised-local`。日常任务不必手动操作每轮收发命令，Codex 根据 skill 处理。

每个任务在当前工作区建立 `astra/tasks/<任务 ID>/`：`uploads` 是选定附件副本，`messages` 是出站说明，`feedback` 是网页回复，`outputs` 是交付物，`checks` 是验证与恢复证据。`state.json` 保存进度和网页会话地址。也可把候选文件放在 `astra/inbox/` 再告诉 Codex 任务，放入文件本身不会自动上传。

登录由你亲自在浏览器完成，随后复用浏览器现有登录状态；网站要求重新登录或验证时仍需你处理。扩展和远程服务不自行唤醒 Codex，也不替代 Codex 持续运行。网页建议始终受原任务范围约束。

## 开发与打包

Python 3.10+；服务器浏览器服务需要 Node.js 20+。本地版的服务器桥接仅使用 Python 标准库。扩展无需构建。

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
npm ci
npx playwright install chromium
node tests/test_extension.mjs
python tools/package.py
```

最后一条生成两个 ZIP 和 `dist/SHA256SUMS`。打包只从列出的源码目录收集文件，不收集浏览器配置、登录资料、聊天记录或研究文件。仓库默认不含运行状态。

安装位置遵循 [OpenAI 官方 skill 文档](https://developers.openai.com/codex/skills)；本地扩展的页面通信与服务器请求分别使用 Chrome 的 [消息传递](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) 和 [扩展网络请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests) 能力。
