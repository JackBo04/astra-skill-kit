---
name: selfguide-local
description: 使用用户电脑浏览器中的 ChatGPT 指导服务器上的 Codex 执行、反馈与验收；用于 SelfGuide 网页协作任务。
---
# SelfGuide · 文本通道实验版

网页主导方案、写作和验收，Codex 在用户选定的服务器执行。首轮发送用户任务、已有背景与完成标准，请网页提出所需信息和下一步；之后反馈新增结果与疑问，沿用原会话直到完成。材料按需补充，常规修复自主处理，真正需要用户决定时再问。

常规只读 [收发流程](references/dom-bridge.md)，已读内容无需每轮重读。优先 DOM 文本与程序等待；只有文本无法诊断的特殊异常才截图。任务记录保存在文件，恢复时先读简短状态及最新交接，不搬入全部历史；需要追溯再读对应记录。

按需读取：
- 涉及正文起草、修改或翻译：[写作模块](modules/writing.md)。绘图、实验迭代模块暂空。
- 初始化或配对：[连接设置](references/setup.md)。独立安装测试，不替换主版本。
- 网页默认 xhigh／Extra High，难点用可用的 Pro；需核对或切档时读 [档位](references/leadership.md)。这指网页档位，提示词不能切档。
- 收发中断：[恢复](references/recovery.md)；正文格式或下载问题：[文本交接](references/text-handoff.md)。

复用登录，凭据保留在原设备；登录和人机验证由用户处理。
