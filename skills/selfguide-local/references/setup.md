# 连接设置

安装器把 `extension/` 复制到 skill 内。服务器浏览器版在服务器 Chrome 加载扩展并直连桥接，默认端口 8766；本地浏览器版在用户电脑加载扩展，经 SSH 隧道连接服务器，默认端口 8765。

用 `SELFGUIDE_BRIDGE_HOME` 指向独立测试目录，然后运行：

```bash
python <skill>/scripts/bridge.py init --project-url <实际selfguide项目URL> --port <端口>
python <skill>/scripts/bridge.py serve
```

在目标 Chrome 扩展管理页加载 skill 的 `extension/`，用 `bridge.py pairing` 返回的信息绑定项目标签页。配对码只填扩展，不写入聊天或公开报告。复用已有登录；不自动重启当前浏览器。不要让主版与实验版同时控制同一标签页。

本地 SSH 转发服务器桥接端口到电脑相同端口，例如 `ssh -N -L 8765:127.0.0.1:8765 <服务器>`；两侧端口按实际配置填写。执行环境与桥接须保持运行，本工具不会自行唤醒 Codex。
