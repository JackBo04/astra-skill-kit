# 文本通道与自动等待（实验分支）

本分支使用浏览器扩展和回环桥接，默认从 DOM 获取状态与原文。普通收发不调用截图。`snapshot` 会带完整最近消息，只在需要文本诊断时主动调用；常规使用 `status`，它不返回草稿或上一轮正文。

## 初始化与绑定

服务器浏览器版：扩展加载在服务器的 Chrome，直接连接同一服务器的桥接；本地浏览器版：扩展加载在自己电脑，使用原有 SSH 隧道。两者代码相同，测试配置可用 `SELFGUIDE_BRIDGE_HOME` 指向独立目录。服务器默认桥接配置在浏览器运行目录的 `dom-bridge/`，端口 8766；本地默认沿用原桥接目录，端口 8765。

安装器会把 `extension/` 一起复制到 skill 内。用 `bridge.py init --project-url <实际项目URL> --port <端口>` 初始化独立测试配置，再运行 `bridge.py serve`。在目标 Chrome 的扩展管理页加载该 extension 目录，使用 `bridge.py pairing` 返回的信息绑定 selfguide 标签页。配对码只填扩展，不发送到网页聊天或写进公开报告。首次绑定在浏览器界面进行；不为本分支自动重启或修改现有登录浏览器。

## 常规收发

`<skill>` 是实验安装目录，`<run>` 是本任务记录目录。每个新任务在同一 selfguide 项目中新建会话；后续沿用该会话。

```bash
python <skill>/scripts/session.py new --task-file <任务.txt> --workspace <实验任务目录>
python <skill>/scripts/bridge.py project --out <run>/checks/project-001.json
python <skill>/scripts/bridge.py status --out <run>/checks/status-001.json
```

读取返回文件中的 `result.url` 作为实际地址；URL 会有名称 slug，不能凭项目配置猜测完整地址。`status` 没有显式地址时只检查已绑定的配置项目；之后的每次操作都传实际 `--expect-url`。页面 `waiting/page_loading` 时程序等候，不截图；`composer:true` 后继续。`thinking_label` 只是可见按钮文字线索，不足以单独证明 Pro 档位；有歧义时按异常处理核对实际控件。本分支没有新增自动切换档位功能。

选定附件先 `session.py stage`，再 `bridge.py attach --file <上传副本> --expect-url <实际URL> --out <检查文件>`。扩展等待对应文件卡片及上传完成；只有 `upload_confirmed:true` 才继续。超时记为 `upload_unconfirmed`，核对具体错误，必要时拍一次诊断图；不重复上传来碰运气。

```bash
python <skill>/scripts/session.py prepare --run <run> --file <本轮说明.txt>
python <skill>/scripts/bridge.py compose --file <run>/messages/out-001.txt --expect-url <实际URL> --out <run>/checks/compose-001.json
python <skill>/scripts/session.py submitting --run <run>
python <skill>/scripts/bridge.py send --file <run>/messages/out-001.txt --expect-url <实际URL> --out <run>/checks/send-001.json
python <skill>/scripts/session.py sent --run <run> --url <send返回的会话URL>
python <skill>/scripts/wait_reply.py --file <run>/messages/out-001.txt --expect-url <会话URL> --out <run>/checks/wait-001.json --reply-out <run>/feedback/copied-001.txt
python <skill>/scripts/session.py reply --run <run> --file <run>/feedback/copied-001.txt --source dom
```

`prepare` 返回的消息含交接标记，必须发送该文件。`compose` 在程序内核对全文，只返回 `draft_verified:true` 和简短状态；无需再截图确认草稿。`send` 只有确认本轮用户消息出现才返回 `sent:true`。结果不明先查原 job，不能重新发送。任何步骤有 `error`、`blocked`、或缺少预期成功字段时，不推进到下一步。

## 等待与恢复

`wait_reply.py` 是普通 Python 程序，默认最多等 900 秒，每 3 秒查询回环桥接。生成中的检查只返回状态，正文等生成标志结束、当前回复有回复级复制按钮且文字稳定后才交接。代码块自己的复制按钮不算回复完成。

启动等待后可处理独立工作；终端工具每次最多等 55 秒，未结束继续保留原进程即可。不要用截图或让模型每几秒判断一次页面。不需要把状态文件每次变化都读进模型上下文。需要进度时只读该小文件。

超时退出码 3 表示仍未完成，继续用原命令加 `--resume`；它沿用已保存的读取 job，不发送用户消息。退出码 2 表示需要诊断。原进程还在运行时不另起 watcher。`bridge.py job <ID>` 可查询原操作，明确状态后按原恢复规则处理；断线不代表消息没发出去。

完成后，所选交接正文写到 `--reply-out`，完整回复另存为 `<reply-out>.full.txt`。状态文件只有路径、摘要、状态和检查次数，标准输出也不包含正文。按任务读取正文一次；核对块外内容时按需读取完整原文。原任务和轮次检查仍由 `session.py reply` 执行。

## 异常截图

遇到登录／验证、持续找不到控件、未确认上传或其他无法从文本判断的异常，先读取具体错误；仍需看页面才截图。`screenshot_recommended` 是提示，不会自动截图。等待生成、普通超时和重复读取成功回复都不触发截图。

服务器诊断命令：`desktop.py screenshot --reason <具体异常> --out <诊断.png>`。其他桌面工具只在诊断或修复该异常时使用；处理完返回文本通道。本地异常需要用户查看本地浏览器，不能截取服务器桌面冒充本地页面。登录和人机验证仍交用户处理，不改变指纹或绕过验证。

DOM 状态和文字稳定是页面侧判断，无法保证网站未来不改变结构。此实验方案不承诺规避风控；技术联调成功不等于服务条款授权。
