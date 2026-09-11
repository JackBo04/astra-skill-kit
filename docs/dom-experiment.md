# DOM 文本通道实验

本分支独立开发测试，不合并到主分支。默认独立安装；也可按下面的方法备份后替换现有 skill。任务档案单独保存，不复制浏览器 profile 或导出登录资料。

## 服务器浏览器

1. 按 README 安装 server 到独立目录。
2. 在运行桥接和 session 工具的终端设置独立配置位置：

```bash
export SELFGUIDE_BRIDGE_HOME="$HOME/.local/share/selfguide-dom-test/bridge"
python <实验skill>/scripts/bridge.py init --project-url '<实际selfguide项目URL>' --port 8766
python <实验skill>/scripts/bridge.py serve
```

3. 将实验安装目录中的 `extension/` 加载到服务器 Chrome。此步骤通过服务器浏览器的扩展管理页完成；不要让试用流程重启或替换已登录 Chrome。若当前 Chrome 不接受加载，记录具体限制，不修改指纹或账户验证方式。
4. 在自己终端运行 `bridge.py pairing`，将结果填入扩展，并在 selfguide 标签页绑定。配对地址为服务器自己的 `http://127.0.0.1:8766`，不需要 SSH 将 8766 转发到用户电脑，因为扩展也在服务器。
5. 用一个只含合成材料的专用新会话测试，任务记录放在独立实验目录。正常收发按 [文本流程](../skills/selfguide-server/references/dom-bridge.md) 进行。不要让主版和实验版同时控制同一标签页。

## 替换当前服务器安装试用

在实验分支工作区执行：

```bash
python3 tools/install.py server --name selfguide --update
```

安装位置按当前环境补充 `--skills-dir <现有skills目录>`；安装器打印旧版备份位置，保留 `$selfguide` 调用名和既有符号链接。下一条消息即可读取新版指令。桥接初始化一次后复用配置，不重复配对。

扩展须在真实 Chrome 中加载并绑定，安装 skill 本身不等于浏览器已连接。如果“加载已解压的扩展”的目录选择框无法打开，可以将 `extension/` 目录拖入已开启开发者模式的扩展管理页。更新扩展后重新加载扩展，并在未发送操作已妥善记录时刷新专用任务标签页，使内容脚本生效；不必退出 ChatGPT。

## 自己电脑浏览器

安装 local 到独立目录，同样设置 `SELFGUIDE_BRIDGE_HOME`，在服务器启动桥接。扩展加载在自己电脑，再建立仅用于测试的 SSH 转发，例如：

```bash
ssh -N -L 127.0.0.1:8766:127.0.0.1:8766 your-server
```

原本地扩展先暂停，测试扩展绑定专用标签页。需要原配对的生产配置保持不动；实验用独立配置初始化一次即可。

## 诊断与退出

`status` 是常规小型状态；`snapshot` 是显式文本诊断，包含最近消息。等待超时继续原 watcher，不自动截图。遇到页面或控件异常先读取错误，确实需要视觉判断才使用服务器 `desktop.py screenshot --reason '<异常原因>' --out <路径>`，或由用户查看本地页面。

结束独立试用时可暂停扩展和桥接；要继续使用则保持连接。替换安装后可用安装器输出的备份恢复旧 skill。服务器扩展已完成真实加载与配对，最新验收范围见 [验证记录](validation.md)。

## 多窗口任务

`session.py new` 为每个任务产生唯一 ID；所有 `bridge.py` 和 `wait_reply.py` 调用带 `--run <该任务目录>`。`open --run` 在后台开独立窗口，重复 open 返回原窗口；每路任务有独立队列和结果记录，不以当前前台窗口决定目标。

网页生成不占用命令执行槽；扩展最多同时处理四个任务的短操作，每个任务内部保持顺序，其余排队。各窗口共用登录和账户额度。任务窗口自动平铺；不要将运行中的窗口最小化或用其他全屏窗口长期遮挡，否则浏览器可能暂停网页刷新。异常需要画面时用 `focus --run` 明确切到该任务，再截图。

窗口关闭或浏览器重启导致绑定未确认时，`open --run <任务目录> --restore --out <检查文件>` 只恢复已保存的会话 URL。首次发送结果不明时，先处理原 job，不能通过新开窗口重发。旧 watcher 的恢复参数必须保持一致，不中途添加 `--run`；旧轮次结束后可以为原任务开启独立窗口。

## 自动检查

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_extension.mjs
node tests/test_multi_window.mjs
SELFGUIDE_TEST_VARIANT=server node tests/test_extension.mjs
SELFGUIDE_TEST_VARIANT=local node tests/test_multi_window.mjs
```

扩展测试需要 Playwright 的 Chromium（支持加载扩展）及其系统依赖。`SELFGUIDE_TEST_MODULE_ROOT` 可指向包含 Playwright 的已有 package.json，`PLAYWRIGHT_BROWSERS_PATH` 可指定已有测试浏览器。测试使用临时 profile 与受控页面，浏览器请求由测试框架拦截，不向真实 ChatGPT 发送任务。测试代码中的 `--no-sandbox` 用于当前隔离测试环境，不是已登录浏览器的升级命令。
