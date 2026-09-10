# 配置与操作

`<skill>` 是安装后的 skill 目录，`<run>` 是 `session.py new` 输出目录。所有命令在 Codex 连接的服务器执行。初次安装、SSH 与扩展配置见发行包 `docs/local-browser.md`。

`ASTRA_LOCAL_HOME` 可指定独立连接目录，默认为 `~/.local/share/astra-local-bridge`；配对配置和任务队列不放 Git 仓库。一个服务对应一个配置的 astra 项目及一个本地标签页。

```bash
python <skill>/scripts/bridge.py init --project-url <astra项目完整URL>
python <skill>/scripts/bridge.py serve
# pairing 命令仅供用户在自己终端查看配对码；不要把输出写进仓库、网页或任务报告。
python <skill>/scripts/bridge.py pairing
python <skill>/scripts/session.py new --task-file <任务.txt> --workspace <工作区>/astra
python <skill>/scripts/bridge.py project --out <run>/checks/open-001.json
python <skill>/scripts/bridge.py snapshot --expect-url <网页实际URL> --out <run>/checks/view-001.json
python <skill>/scripts/session.py stage --run <run> --file <选定材料>
python <skill>/scripts/bridge.py attach --file <run>/uploads/<材料> --expect-url <网页实际URL> --out <run>/checks/attach-001.json
python <skill>/scripts/session.py prepare --run <run> --file <本轮说明.txt>
python <skill>/scripts/bridge.py compose --file <run>/messages/out-001.txt --expect-url <网页实际URL> --out <run>/checks/compose-001.json
python <skill>/scripts/session.py submitting --run <run>
python <skill>/scripts/bridge.py send --file <run>/messages/out-001.txt --expect-url <网页实际URL> --out <run>/checks/send-001.json
python <skill>/scripts/session.py sent --run <run> --url <send结果中的会话URL>
python <skill>/scripts/bridge.py reply --file <run>/messages/out-001.txt --expect-url <会话URL> --out <run>/checks/reply-001.json
# 保留上一步 JSON，核对完整 result.text；优先保存 result.handoff_text（否则 result.text）为 UTF-8 文件：
python <skill>/scripts/session.py reply --run <run> --file <回复.txt> --source dom
python <skill>/scripts/session.py checkpoint --run <run> --phase complete --note-file <验收说明.txt>
```

URL 必须与浏览器实际地址一致。项目地址可能自动增加 `-astra`；`snapshot` 的错误提示或扩展绑定页可辅助核对，不修改项目 ID 来迁就错误线程。

`bridge.py` 不返回密码和 Cookie；`snapshot` 只读取当前任务最近收发、输入框、提示和附件状态，不读取历史侧栏。`reply` 返回完整最近回复文本但不保存网页视觉排版，需要图表或文件时另行按任务选取。

附件为单文件最多 8 MiB，这是桥接程序的默认传输限制，不是 ChatGPT 网站的官方上限。更大材料先按问题提取小样本、摘要或图表。文件通过 SSH 隧道到本地扩展再上传；本地无需手动下载中转文件。每轮在清单记录实际上传与读取证据，初次验证用附件中独有的随机码。

```bash
python <skill>/scripts/bridge.py job <原job-ID>
python <skill>/scripts/bridge.py resolve <原job-ID> --note-file <页面核对结果.txt>
python <skill>/scripts/session.py checkpoint --run <run> --phase paused --note-file <中断说明.txt>
python <skill>/scripts/session.py resume --run <run>
```

收到 `error` 必须检查具体原因。页面选择器变化时可维护 `extension/content.js` 并让用户重新加载扩展与标签页；不能调用私有登录接口或绕过网站验证。
