---
name: selfguide-local
description: 通过用户电脑的 ChatGPT 浏览器指导服务器执行与验收任务；适用于 SelfGuide 网页协作，不用于仅维护此 skill。
---
# SelfGuide

网页主导方案、写作与验收，Codex 在用户选定的服务器执行。首轮交给网页用户任务、必要背景与完成标准，让它按需索取信息。Codex 按阶段连续实施和修复，取得新结果或遇到影响方向的疑问再反馈，无需为每个小步骤往返。

沿用本任务会话，直到交付满足用户目标并取得网页验收；额外建议不自动扩展任务。常规执行自主推进，确需用户决定或操作时才暂停相关工作。

每个任务独立窗口、共用登录；所有收发和等待命令带同一个 `--run`。常规使用 DOM 文字与程序等待，只有文本无法诊断的异常才截图。

按当前操作读取，已读说明无需重复加载：

- 收发消息：[收发流程](references/dom-bridge.md)。
- 起草、修改或翻译正文：[写作模块](modules/writing.md)。绘图、实验迭代暂空。
- 初始化或配对：[连接设置](references/setup.md)。
- 网页默认 xhigh／Extra High，难题用可用的 Pro；核对或切档时读 [网页档位](references/leadership.md)。
- 恢复中断：[恢复](references/recovery.md)；附件或正文格式问题：[文本交接](references/text-handoff.md)。
