# DOM 文本通道实验

本分支只在独立工作区开发测试，不合并或安装到主版本。安装路径、桥接配置、端口和任务档案均使用实验目录；不复制浏览器 profile 或导出登录资料。

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

## 自己电脑浏览器

安装 local 到独立目录，同样设置 `SELFGUIDE_BRIDGE_HOME`，在服务器启动桥接。扩展加载在自己电脑，再建立仅用于测试的 SSH 转发，例如：

```bash
ssh -N -L 127.0.0.1:8766:127.0.0.1:8766 your-server
```

原本地扩展先暂停，测试扩展绑定专用标签页。需要原配对的生产配置保持不动；实验用独立配置初始化一次即可。

## 诊断与退出

`status` 是常规小型状态；`snapshot` 是显式文本诊断，包含最近消息。等待超时继续原 watcher，不自动截图。遇到页面或控件异常先读取错误，确实需要视觉判断才使用服务器 `desktop.py screenshot --reason '<异常原因>' --out <路径>`，或由用户查看本地页面。

测试结束暂停／移除实验扩展，停止实验桥接，保留记录即可；无需回退主分支或恢复账户登录。本次开发阶段仅完成受控页面测试，没有对当前登录账户加载或配对实验扩展。

## 自动检查

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_extension.mjs
SELFGUIDE_TEST_VARIANT=server node tests/test_extension.mjs
```

扩展测试需要 Playwright 的 Chromium（支持加载扩展）及其系统依赖。`SELFGUIDE_TEST_MODULE_ROOT` 可指向包含 Playwright 的已有 package.json，`PLAYWRIGHT_BROWSERS_PATH` 可指定已有测试浏览器。测试使用临时 profile 与受控页面，浏览器请求由测试框架拦截，不向真实 ChatGPT 发送任务。测试代码中的 `--no-sandbox` 用于当前隔离测试环境，不是已登录浏览器的升级命令。
