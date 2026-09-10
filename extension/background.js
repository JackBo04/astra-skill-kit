'use strict';
let busy = false;
const cleanURL = value => { const u = new URL(value); return u.origin + u.pathname; };
function inProject(value, key) {
  const u = new URL(value);
  return u.origin === 'https://chatgpt.com' && !u.search && !u.hash &&
    new RegExp('^/g/' + key + '(?:-[^/]+)?/(project|c/[A-Za-z0-9-]+)$').test(u.pathname);
}
async function rpc(cfg, route, body = {}) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(cfg.endpoint)) throw Error('地址必须是 http://127.0.0.1:端口');
  const response = await fetch(cfg.endpoint + route, {method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer ' + cfg.token},
    body:JSON.stringify(body), signal:AbortSignal.timeout(12000), credentials:'omit', redirect:'error'});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '连接失败');
  return data;
}
async function poll() {
  if (busy) return;
  busy = true;
  try {
    const cfg = await chrome.storage.local.get(['endpoint','token','tabId','enabled','pendingResult']);
    if (!cfg.enabled || cfg.tabId === undefined) return;
    if (cfg.pendingResult) {
      await rpc(cfg, '/result', cfg.pendingResult);
      await chrome.storage.local.remove('pendingResult');
    }
    const info = await rpc(cfg, '/info');
    const tab = await chrome.tabs.get(cfg.tabId);
    const job = await rpc(cfg, '/poll');
    if (job.idle) { await chrome.storage.local.set({status:'已连接，等待 Codex 任务'}); return; }
    let result;
    try {
      if (!tab.url || !inProject(tab.url, info.project_key)) throw Object.assign(new Error('绑定标签页需要登录、验证或返回已配置项目。'), {code:'page_unavailable'});
      if (tab.status === 'loading') {
        result = {status:'waiting',reason:'page_loading'};
      } else if (job.command.action === 'project') {
        // A fresh project landing page creates the next chat on its first send.
        const state = await chrome.tabs.sendMessage(cfg.tabId, {type:'selfguide-command', id:job.id,
          command:{action:'status',expected_url:cleanURL(tab.url)}});
        if (state.error || state.generating || state.draft_present || state.attachments?.length) throw Error('当前页面有未完成生成、草稿或附件；先处理再创建新会话。');
        await chrome.tabs.update(cfg.tabId, {url:job.project_url});
        result = {navigated:true,url:job.project_url,next:'Read compact status until the project composer is ready.'};
      } else {
        result = await chrome.tabs.sendMessage(cfg.tabId, {type:'selfguide-command',id:job.id,command:job.command});
      }
    } catch (error) { result = {status:'blocked',error:String(error.message || error),code:error.code || 'extension_unavailable',uncertain:true,screenshot_recommended:true}; }
    const pendingResult = {id:job.id,result};
    // Persist before acknowledgement; never run the action again after a lost response.
    await chrome.storage.local.set({pendingResult,status:result.error ? '操作暂停：' + result.error : '已完成本次网页操作'});
    await rpc(cfg, '/result', pendingResult);
    await chrome.storage.local.remove('pendingResult');
  } catch (error) { await chrome.storage.local.set({status:'连接暂停：' + String(error.message || error)}); }
  finally { busy = false; }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message.type === 'selfguide-heartbeat') {
      const cfg = await chrome.storage.local.get('tabId');
      if (sender.tab?.id === cfg.tabId && sender.url?.startsWith('https://chatgpt.com/')) await poll();
      return {ok:true};
    }
    // Configuration is accepted only from the extension's own popup, never a web page.
    if (sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) throw Error('Invalid configuration sender.');
    if (message.type === 'selfguide-bind') {
      const cfg = {endpoint:message.endpoint,token:message.token};
      const info = await rpc(cfg, '/info');
      const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
      if (!tab || !inProject(tab.url || '',info.project_key)) throw Error('先打开服务器配置的 selfguide 项目页面，再点连接。');
      const old = await chrome.storage.local.get(['pendingResult','endpoint','token']);
      if (old.pendingResult && (old.endpoint !== cfg.endpoint || old.token !== cfg.token)) throw Error('上一连接仍有未确认结果，请恢复原连接后再切换。');
      await chrome.storage.local.set({...cfg,tabId:tab.id,enabled:true,status:'已绑定当前 selfguide 标签页'});
      await chrome.alarms.create('selfguide-poll',{periodInMinutes:1});
      await poll(); return {ok:true};
    }
    if (message.type === 'selfguide-pause') {
      await chrome.storage.local.set({enabled:false,status:'已暂停；登录状态保持不变'}); return {ok:true};
    }
    throw Error('Unknown message.');
  })().then(respond, error => respond({error:error.message}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'selfguide-poll') poll(); });
