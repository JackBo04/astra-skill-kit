# 服务器浏览器版

此版本保留现有做法：Codex 和专用 Chrome 都在服务器上。你在自己电脑的浏览器或 Codex 侧边浏览器中打开远程画面，首次自行登录，然后保持服务器浏览器运行。

## 已有服务器浏览器时

在连接服务器的终端中进入解压后的服务器版包目录：

```bash
python tools/install.py server
python ~/.agents/skills/chatgpt-supervised-server/scripts/browserctl.py status
```

如果已有服务正常运行，直接复用。不重启浏览器，不重新建登录目录。现有部署使用 `~/.local/share/codex-chatgpt-browser`，安装后的 skill 也默认查找这个目录。

开启新的 Codex 会话后说：

```text
使用 $chatgpt-supervised-server，让 astra 网页版指导你完成 <任务>。
材料在 <服务器路径>，验收标准是 <标准>。按反馈持续执行。
```

原来的 `chatgpt-supervised-work` 不会被安装工具改动。如果两个版本都安装了，在任务里明确指定上述名称。

## 新服务器安装

提供的桌面服务针对 Linux X11。需要 Python 3.10+、Pillow（支持 XCB 截图）、Node.js 20+、普通 Google Chrome、Xvfb、xauth、x11vnc、xdotool 和 xclip。下面是 Debian／Ubuntu 有管理员权限时的依赖示例：

```bash
sudo apt-get install xvfb xauth x11vnc xdotool xclip python3-pil libgtk-3-0 fonts-liberation
```

Node.js 与 Google Chrome 使用各自官方安装方式。没有管理员权限时可让服务器管理员安装依赖，或使用已经准备好的用户目录安装。发行包不包含操作系统二进制，也不会自动修改服务器权限。

安装 skill 后，在其桌面服务目录安装 Node 依赖：

```bash
cd ~/.agents/skills/chatgpt-supervised-server/runtime/server-browser
npm ci
```

在自己账户创建或打开 **astra** 项目，复制项目完整 URL。返回任意目录执行：

```bash
python ~/.agents/skills/chatgpt-supervised-server/scripts/browserctl.py setup --project-url '你的astra项目URL'
python ~/.agents/skills/chatgpt-supervised-server/scripts/browserctl.py start
python ~/.agents/skills/chatgpt-supervised-server/scripts/browserctl.py status
python ~/.agents/skills/chatgpt-supervised-server/scripts/browserctl.py url
```

`start` 检查已有服务，已有就复用。新服务默认使用显示号 97、远程查看端口 6080 和仅供内部使用的 VNC 端口 5907；发生冲突时先诊断已有进程，不删除锁文件强制启动。Chrome 和 Xvfb 路径可分别通过 `ASTRA_CHROME`、`ASTRA_XVFB` 指定；运行根目录可用 `CHATGPT_BROWSER_HOME` 指定，同一部署的脚本需使用一致环境变量。

Chrome 默认启用沙箱。某些受限服务器不支持沙箱，只有确认这一限制并接受影响后，才用 `start --allow-no-sandbox`。不要以解决登录问题为由自动关闭沙箱或改变浏览器指纹。

## 打开远程画面并登录

在自己电脑的本地终端建立 SSH 转发：

```bash
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:6080:127.0.0.1:6080 your-server
```

打开 `browserctl.py url` 输出的私有链接。VS Code 端口转发或 Codex 应用映射后的端口可能不同，按实际端口替换，链接末尾的私有路径保持不变。这个入口控制服务器桌面，不要公开分享。

首次在画面中由你输入邮箱、密码或验证码；遇到人机验证也由你操作。该专用 Chrome 使用固定 `profile-manual/`，后续任务复用登录。关闭远程查看页面不会主动关闭服务器 Chrome；网站要求重新登录时仍需人工处理，不能保证登录永不失效。

新任务在 astra 中新建会话，材料和结果保存在当前工作区 `astra/tasks/`。附件通过服务器系统文件剪贴板上传。原部署的原生文件选择弹窗不可用，已用文件粘贴真实验证 TXT 和 JSON，因此无需为上传重启浏览器。

## 验证与恢复

首次安装让 Codex 先用合成小文件测试：附件独有随机码 → 网页指导 → 本地结果与独立检查 → 结果上传与网页验收。只有看到真实文件读取证据才继续重要任务。

任务中断后先读 `state.json` 和最近记录，再核对原会话。`send_pending` 代表发送尚未确认，不能直接重复提交。恢复时保持当前浏览器和登录目录；不复制 Cookie、不删除登录资料，也不自动处理验证码。
