# 收发流程

下列命令在服务器运行。`<skill>` 是实验安装目录，`<run>` 是任务目录，`<url>` 必须取自返回文件的 `result.url`，不可猜测。按本轮编号替换 `001`。命令成功后才执行下一步。

新任务在 selfguide 项目自动打开独立窗口。已有任务先读 `session.py status --run <run> --brief`；`open --run` 复用该任务窗口，不能用 `project` 重置会话。

```bash
python <skill>/scripts/session.py new --task-file <任务.txt> --workspace <工作区>
python <skill>/scripts/bridge.py open --run <run> --out <run>/checks/window-001.json
python <skill>/scripts/bridge.py status --run <run> --out <run>/checks/status-001.json
```

`open` 须返回 `window_opened:true`。每个任务独立编号、文件和窗口，后台按任务分别排队，正常收发不切前台。`status` 只返回小型状态；`composer:true` 后继续。需要附件时先 `session.py stage --run <run> --file <材料>`，再用 `bridge.py attach --run <run> --file <返回的上传副本> --expect-url <url> --out <检查文件>`，确认 `upload_confirmed:true`。

```bash
python <skill>/scripts/session.py prepare --run <run> --file <本轮说明.txt>
python <skill>/scripts/bridge.py compose --run <run> --file <run>/messages/out-001.txt --expect-url <url> --out <run>/checks/compose-001.json
python <skill>/scripts/session.py submitting --run <run>
python <skill>/scripts/bridge.py send --run <run> --file <run>/messages/out-001.txt --expect-url <url> --out <run>/checks/send-001.json
python <skill>/scripts/session.py sent --run <run> --url <send返回的会话URL>
python <skill>/scripts/wait_reply.py --run <run> --file <run>/messages/out-001.txt --expect-url <会话URL> --out <run>/checks/wait-001.json --reply-out <run>/feedback/copied-001.txt
python <skill>/scripts/session.py reply --run <run> --file <run>/feedback/copied-001.txt --source dom
```

发送 `prepare` 生成的文件，它已追加本轮交接标记。`compose` 须返回 `draft_verified:true`，`send` 须返回 `sent:true`；结果不明先查原 job，不能重发。`send_pending` 不代表发送失败。

`wait_reply.py` 自行等待完整回复，不需要模型轮询页面。终端每次最多等 55 秒；原进程未结束时保留它，不另启 watcher。正常等待不读状态文件、不截图；超时退出码 3 时用原参数加 `--resume`；退出码 2 时读 [恢复](recovery.md)。

登记成功后读取交接正文一次，执行并验证，再向原会话反馈新增结果。完整原文另存为 `copied-001.txt.full.txt`，需要核对块外内容才读取；不重复加载同一正文的多个副本。完成原任务并取得网页验收后，用 `session.py checkpoint --run <run> --phase complete --note-file <完成说明>` 记录完成。其他参数按需查看对应命令的 `--help`。
