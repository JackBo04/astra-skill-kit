# 服务器浏览器与 astra

- 项目名称：`astra`
- 项目地址：从运行目录的 `run/astra-project.json` 读取，初次用 `browserctl.py setup --project-url <URL>` 配置。
- 运行目录：`~/.local/share/codex-chatgpt-browser`
- 普通 Chrome 登录资料在该目录的 `profile-manual/`，仅由 Chrome 使用，不读取或导出凭据。
- 桌面配置在 `run/config.json`，含访问密钥，不输出整个文件。服务通过服务器回环端口 6080 提供远程画面，用户本地端口可能变化；需要入口时读 `run/access-url.txt` 并按实际转发端口替换。
- 默认启用 Chrome 沙箱；仅当服务器确实不支持且用户接受时，用启动选项 `--allow-no-sandbox`。已验证的原服务器受此限制使用该选项，发行包不默认关闭沙箱。
- Playwright 测试浏览器曾遇到登录验证循环；原部署的普通 Chrome 已由用户手动登录；新安装可能需要首次手动登录。收发使用可见桌面和系统剪贴板，保持现有浏览器，不为了自动化重新启动登录流程。

## 操作

`<skill>` 为本 skill 目录，`<run>` 为任务独立记录目录。参数用结构化工具或正确 shell 引用传入。

```bash
python <skill>/scripts/desktop.py screenshot --out <run>/screen.png
python <skill>/scripts/desktop.py url
python <skill>/scripts/desktop.py goto <astra项目URL>
python <skill>/scripts/desktop.py click <x> <y>
python <skill>/scripts/desktop.py key Escape
python <skill>/scripts/desktop.py attach --file <run>/uploads/<selected-file> --expect-url <expected-url> --x <input-x> --y <input-y>
python <skill>/scripts/desktop.py paste --file <run>/messages/out-001.txt --expect-url <expected-url> --x <input-x> --y <input-y>
python <skill>/scripts/desktop.py copy-reply <copy-x> <copy-y> --expect-url <conversation-url> --out <run>/feedback/copied-001.txt
```

查看 `screenshot` 返回的图片后再决定坐标。`url` 会聚焦地址栏，下一次输入前重新点选网页输入框。`paste` 只填入不提交。

`attach` 通过桌面文件剪贴板粘贴一个已选定的服务器文件，随后清空剪贴板；返回成功只表示已执行粘贴。截图确认附件卡片已加载后，再填消息和提交。浏览器可能给附件改名，所以消息中说明原文件名与内容用途。项目 URL 可能自动增加 `-astra`，输入前读取实际地址并与已保存的项目 ID 核对。

当前普通 Chrome 启动时缺少原生文件选择组件，补装 GTK 依赖后现有进程仍未弹窗；保持登录进程并使用文件粘贴。已实测 TXT 材料上传、JSON 结果回传及网页版读取验收，不把这次测试推广为所有格式和大小均可用。

`copy-reply` 设置随机剪贴板标记后点击指定的回复复制按钮，确认内容变化才保存。它输出文件路径和摘要，完整文字留在文件中。只复制当前任务的单条回复，不全选侧栏或批量读取其他聊天。

回复很长时，在页面内容区域定位后滚到末尾；不要向聚焦的输入框发送会选择或删除文字的快捷键。生成未结束时等待，不反复发送或停止生成。

## 任务记录

```bash
python <skill>/scripts/session.py new --task-file <task.txt> --workspace <工作区>/astra
python <skill>/scripts/session.py stage --run <run> --file <selected-source-file>
python <skill>/scripts/session.py prepare --run <run> --file <message.txt>
python <skill>/scripts/session.py submitting --run <run>
python <skill>/scripts/session.py sent --run <run> --url <conversation-url>
python <skill>/scripts/session.py reply --run <run> --file <reply.txt> --source clipboard
python <skill>/scripts/session.py checkpoint --run <run> --phase executing --note-file <progress.txt>
python <skill>/scripts/session.py checkpoint --run <run> --phase waiting_user --note-file <blocking-issue.txt>
python <skill>/scripts/session.py resume --run <run>
python <skill>/scripts/session.py checkpoint --run <run> --phase complete --note-file <acceptance.txt>
```

prepare 输出本轮待发送文件；先记录 submitting，再点网页发送，看到发送成功后才记录 sent。发送结果不明时保持 send_pending 并检查网页，不能再 prepare 一条同样的消息。

用户解决阻碍后，先截图确认再 resume；恢复到暂停前的原阶段，尤其不能把 send_pending 当作已发送成功。

新任务默认建在当前目录的 `astra/tasks/`，明确指定 `--workspace` 可避免工作目录变化产生多个归档位置。原有平铺记录仍可恢复，新任务使用 `uploads/messages/feedback/outputs/checks` 五个子目录。`stage` 不覆盖同名附件，需要不同版本时使用不同文件名。

## 恢复服务

先用 `python <skill>/scripts/browserctl.py status` 检查。`mode: manual-login` 表示普通 Chrome 模式，不代表用户尚未登录；登录状态用截图确认。

服务确实停止才运行 `browserctl.py start`。已登录时不 stop/start，不删除配置目录或锁文件强行恢复。启动后默认打开保存的 astra 项目；如果出现登录页，请用户手动完成。

默认保持浏览器常驻并复用固定的 `profile-manual/`。新任务只在 astra 新建会话；结束任务只保存任务记录，不退出登录。远程查看页面断开不会主动关闭服务器浏览器。服务器进程停止后重新启动仍使用原配置目录，但网站是否接受已有会话由网站决定，不能承诺登录永久有效，也不要用自动刷新或模拟活动试图延长验证期限。

## 初次安装

发行包提供 `docs/server-browser.md`，包含依赖、安装、配置和远程查看步骤。运行目录含登录状态，和 skill 源码及发行包分离。
