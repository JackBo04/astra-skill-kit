<p align="center"><img src="docs/assets/hero.svg" alt="SelfGuide" width="100%"></p>

# SelfGuide · 文本通道实验分支

**普通收发读取网页文字，程序等待生成完成；特殊异常才截图。**

分支：`experimental/dom-text-bridge`。这是独立开发与测试版本，未合并到 `main`，未发布为主版本，也未替换当前已登录浏览器或已安装 skill。稳定版本仍在 [main](https://github.com/JackBo04/selfguide/tree/main)。

| 操作 | 本分支做法 |
| --- | --- |
| 检查网页 | 返回小型状态，不重复传回历史回复或草稿 |
| 填写和发送 | 扩展定位输入框与按钮，并在程序内确认本轮消息 |
| 上传材料 | 检查对应附件卡片与上传完成状态 |
| 等待回复 | Python 程序轮询本机桥接，模型无需不断看图判断 |
| 获取正文 | 从 DOM 保存完整原文与交接块，模型按需读取文件 |
| 出现异常 | 先看结构化错误，仍无法判断时才拍诊断图 |

服务器浏览器和自己电脑浏览器均可加载同一扩展。服务器版直接连接服务器的回环桥接；本地版仍通过 SSH 隧道连接。两种方式都继续使用用户的网页登录，扩展不是官方 ChatGPT API。

## 在独立目录试用

```bash
git clone --branch experimental/dom-text-bridge --single-branch https://github.com/JackBo04/selfguide.git selfguide-dom-bridge
cd selfguide-dom-bridge
python3 tools/install.py server --skills-dir ~/.local/share/selfguide-dom-test/skills
```

本地浏览器版将 `server` 换成 `local`。上述目录不会覆盖主安装；测试会话按完整路径读取所安装 skill 的 `SKILL.md`。安装器也会复制 `extension/`。

具体连接、独立配对和测试步骤见 [实验说明](docs/dom-experiment.md)。已有网页自动化存在服务条款与风控风险，这个分支不承诺避免验证或账号限制，也不实现绕过机制。

## 自动等待示例

完成本轮发送与状态登记后：

```bash
python <实验skill>/scripts/wait_reply.py \
  --file <任务目录>/messages/out-001.txt \
  --expect-url <已确认的会话URL> \
  --out <任务目录>/checks/wait-001.json \
  --reply-out <任务目录>/feedback/copied-001.txt
```

等待过程只更新小型状态文件；正文完成后才保存。超时沿用相同参数加 `--resume`，不重发用户消息。全文另存为 `copied-001.txt.full.txt`，供检查块外信息。截图诊断必须给出 `--reason`。

[完整操作流程](skills/selfguide-server/references/dom-bridge.md) · [验证范围](docs/validation.md)

## 上下文更简洁

常规任务只加载入口与收发流程；写作、安装、切档和异常说明按需读取，不每轮重读。脚本执行不需要把源码送进上下文，等待回复也由程序完成。

| 固定说明（字符数） | 精简前 | 现在 |
| --- | ---: | ---: |
| 普通任务首次读取，服务器版 | 8,497 | 2,542 |
| 普通任务首次读取，本地版 | 8,497 | 2,547 |
| 另需写作模块 | 628 | 243 |
| 每轮自动附加的交接提示 | 352 | 194 |

普通任务固定说明约减少 **70%**。对比基线为实验分支提交 `30e560b`，按文件文本字符计数；交接提示使用同一示例任务号。它不是 token 或账单测量，实际用量还取决于任务、正文长度与模型。

恢复时用 `session.py status --run <任务目录> --brief`，只返回当前状态与最新文件路径；完整历史保留在磁盘，需要追溯时再读。完整回复保存一次，避免重复加载交接块和全文副本；正常反馈只发送新增结果，不重复粘贴整段历史。

## 模块

| 模块 | 状态 |
| --- | --- |
| 写作 | 已启用，网页版主导，Codex 按需补充材料、保存和排版 |
| 绘图 | 预留，暂空 |
| 实验迭代 | 预留，暂空 |

本分支只改收发方式，不扩展空模块，也没有新增自动切换网页档位或本地文件下载回传能力。
