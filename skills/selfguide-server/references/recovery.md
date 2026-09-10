# 收发恢复

先读具体结构化错误与 `session.py status --run <run> --brief`，按路径读取最新交接或检查记录。只有需要追溯时才读取完整状态（省略 `--brief`），不要把全部轮次反复读进上下文。

- 页面 `waiting/page_loading` 或正在生成：保留原等待进程，不截图。watcher 超时加 `--resume`；登录等阻塞处理完后也用它继续。
- 不确定是否发送／上传成功：查 `bridge.py job <ID>`。不要重复提交同一操作。仍未确定时保持原任务状态；需要暂停可用 `session.py checkpoint --phase paused --run <run> --note-file <说明>`，恢复用 `session.py resume --run <run>`。
- 普通小型状态不足时，可用 `bridge.py snapshot` 获取文本诊断；它包含最近消息与草稿，只在此时使用。
- 文本仍无法定位问题时，服务器用 `desktop.py screenshot --reason <具体异常> --out <诊断.png>`。本地浏览器需本地可见工具或用户查看，服务器截图不能代表本地画面。`screenshot_recommended` 只是提示，不自动触发截图。解决后返回 DOM 通道。

登录、人机验证由用户处理，不改变指纹或绕过验证。DOM 结构可能变化，联调成功不代表实站可靠或避免风控。
