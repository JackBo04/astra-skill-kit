---
name: selfguide-local
description: SelfGuide：使用用户电脑上的 ChatGPT 浏览器指导连接到服务器的 Codex 执行、上传材料、反馈结果并评审；用于本地浏览器与 selfguide 协作项目，服务器浏览器请使用另一版本。
---
# SelfGuide 文本通道实验版

网页版主导任务、写作与评审，Codex 实际执行并反馈。先读取 [文本通道与自动等待](references/dom-bridge.md)，使用扩展收发与 `wait_reply.py` 自动等候。默认不截图；只有文本诊断无法解决的异常才看一次画面。不得把“每次操作前截图”作为本分支的流程。

## 模块与分工

按 [模块索引](modules/index.md) 选择模块。写作已启用，由网页版自主起草和修改，Codex 按需补充材料并保存排版；绘图和实验迭代仍为空位，不添加专用规则。读取 [网页主导与档位](references/leadership.md) 和 [完整文本交接](references/text-handoff.md)。网页默认 xhigh，难点使用账户可用的 Pro；实际档位从真实控件核对，不通过提示词假装切档。

## 任务流程

1. 整理用户任务，在独立工作区用 `session.py new` 建档。从配置的 selfguide 项目新建一条会话。
2. 通过 `bridge.py status` 获取小型状态；选定材料用 `session.py stage` 和 `bridge.py attach` 上传，程序确认对应卡片与上传完成。
3. `session.py prepare` 生成本轮消息；`bridge.py compose` 填入并核对。记录 `submitting` 后调用 `bridge.py send`，确认发送才登记 `sent`。
4. 启动 `wait_reply.py`，由程序等待本轮完整回复。正常生成和超时不截图；原进程未结束时不重复启动，超时后用原参数加 `--resume`。
5. 完成后从文件读取原文，用 `session.py reply --source dom` 检查任务与轮次，再执行建议。实际结果回传原会话，持续到完成原任务并得到网页验收。

## 恢复与边界

沿用原会话、任务状态和收发文件；`send_pending` 不等于发送失败。遇到不明操作先查询原 job，不盲目重发。原授权覆盖任务需要的常规收发与可逆实现；新范围或必须用户决定的事再询问。

复用现有登录，保持 Cookie、密码、配对码和账户资料在原设备。登录／人机验证由用户处理。网站验证、额度、网络或 DOM 异常从结构化状态诊断，需要画面时再截图；不通过伪装或绕过限制解决。

此分支以独立目录安装测试，不替换已运行的主版本。它不会自行唤醒 Codex；工作时需要执行环境和桥接保持运行。
