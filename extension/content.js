'use strict';
(() => {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => value.replace(/\r\n/g,'\n').trim();
  const visible = el => el && (el.getClientRects().length > 0) && getComputedStyle(el).visibility !== 'hidden';
  const editor = () => [...document.querySelectorAll('#prompt-textarea,textarea[data-testid="prompt-textarea"],div[contenteditable="true"][role="textbox"]')].find(visible);
  const userMessages = () => [...document.querySelectorAll('[data-message-author-role="user"]')];
  const assistantMessages = () => [...document.querySelectorAll('[data-message-author-role="assistant"]')];
  const text = el => el ? ('value' in el ? el.value : el.innerText) : '';
  const button = selectors => [...document.querySelectorAll(selectors)].find(visible);
  const stop = () => button('[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="停止生成"]');
  const sendButton = () => button('[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"],button[aria-label="发送提示"],button[aria-label="发送消息"]');
  function composer() { const e = editor(); return e?.closest('form') || e?.parentElement?.parentElement; }
  function attachments() {
    const scope = composer();
    if (!scope) return [];
    return [...scope.querySelectorAll('[data-testid*="attachment"],[data-testid*="file"],button[aria-label*="Remove"],button[aria-label*="移除"]')]
      .filter(visible).map(el => ({name:el.getAttribute('aria-label') || el.innerText, busy:!!el.querySelector('[role="progressbar"],.animate-spin')}));
  }
  function snapshot() {
    const users = userMessages(), assistants = assistantMessages(), e = editor();
    return {url:location.origin + location.pathname,composer:!!e,draft:text(e),generating:!!stop(),
      user_count:users.length,assistant_count:assistants.length,
      last_user:text(users.at(-1)),last_reply:text(assistants.at(-1)),attachments:attachments(),
      notices:[...document.querySelectorAll('[role="alert"]')].filter(visible).map(el=>el.innerText).slice(-3)};
  }
  function requirePage(command) {
    if (location.origin !== 'https://chatgpt.com' || location.search || location.hash || location.href !== command.expected_url) throw Error('页面地址不符，未执行。');
    if (!editor()) throw Error('没有找到聊天输入框；可能需要手动登录、验证或适配网页。');
  }
  async function run(command) {
    requirePage(command);
    const e = editor();
    if (command.action === 'snapshot') return snapshot();
    if (command.action === 'reply') {
      const state = snapshot();
      if (state.generating || norm(state.last_user) !== norm(command.text || '')) throw Error('本轮消息尚未确认或回复仍在生成。');
      const last = assistantMessages().at(-1);
      const lastUser = userMessages().at(-1);
      if (!last || !lastUser || !(lastUser.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING)) throw Error('尚无本轮回复，不能读取旧回复。');
      const turn = last.closest('article') || last.parentElement;
      if (!turn?.querySelector('[data-testid="copy-turn-action-button"],button[aria-label*="Copy"],button[aria-label*="复制"]')) throw Error('回复完成标记尚未出现；稍后再检查。');
      await pause(700);
      if (stop() || text(last) !== state.last_reply) throw Error('回复仍在变化，请继续等待。');
      const blocks = [...last.querySelectorAll('pre code')].map(el => el.textContent);
      const handoffs = blocks.filter(value => value.trim().startsWith('SELFGUIDE_REPLY_BEGIN '));
      return {url:state.url,text:state.last_reply,complete:true,
        ...(handoffs.length === 1 ? {handoff_text:handoffs[0]} : {})};
    }
    if (stop()) throw Error('当前回复仍在生成。');
    if (command.action === 'compose') {
      if (norm(text(e)) && norm(text(e)) !== norm(command.text)) throw Error('输入框已有不同草稿，未覆盖。');
      if (!norm(text(e))) {
        e.focus();
        if (e.tagName === 'TEXTAREA') {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,command.text);
          e.dispatchEvent(new Event('input',{bubbles:true}));
        } else {
          const selection = getSelection(), range = document.createRange();
          range.selectNodeContents(e); selection.removeAllRanges(); selection.addRange(range);
          if (!document.execCommand('insertText',false,command.text)) throw Error('编辑器未接受文字；检查草稿后再处理。');
        }
      }
      await pause(300);
      if (norm(text(e)) !== norm(command.text)) throw Error('草稿文字核对失败，未发送。');
      return snapshot();
    }
    if (command.action === 'send') {
      if (norm(text(e)) !== norm(command.text)) throw Error('草稿与本轮记录不一致，未发送。');
      const send = sendButton();
      if (!send || send.disabled || attachments().some(a=>a.busy) || composer()?.querySelector('[role="progressbar"],.animate-spin')) throw Error('发送按钮未就绪或附件仍在上传。');
      const baseline = userMessages().length;
      send.click();
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        const state = snapshot();
        if (state.user_count > baseline && norm(state.last_user) === norm(command.text) && /\/c\//.test(state.url)) return {sent:true,url:state.url,user_count:state.user_count};
        await pause(300);
      }
      throw Error('发送结果未确认；检查网页和任务记录，不能直接重发。');
    }
    if (command.action === 'attach') {
      const f = command.file;
      const bytes = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      if (hash !== f.sha256) throw Error('附件传输校验失败。');
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes],f.name,{type:f.mime}));
      const input = [...document.querySelectorAll('input[type="file"]')].find(x=>!x.disabled);
      if (input) { input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); }
      else { e.focus(); e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true})); }
      await pause(1500);
      return {...snapshot(),file_paste_requested:true,original_name:f.name,sha256:hash,
        upload_confirmed:false,next:'Inspect visible attachment card before sending. A paste event alone does not prove upload.'};
    }
    throw Error('Unsupported action.');
  }
  let active = false;
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type !== 'astra-command') return;
    if (active) { respond({error:'已有网页操作执行中。'}); return; }
    active = true;
    run(message.command).then(respond,error=>respond({error:error.message})).finally(()=>{active=false;});
    return true;
  });
  setInterval(() => { chrome.runtime.sendMessage({type:'astra-heartbeat'}).catch(()=>{}); },2000);
})();
