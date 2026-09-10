'use strict';
const status = document.querySelector('#status');
(async()=>{
  const cfg=await chrome.storage.local.get(['endpoint','token','status']);
  document.querySelector('#endpoint').value=cfg.endpoint || 'http://127.0.0.1:8765';
  document.querySelector('#token').value=cfg.token || '';
  status.textContent=cfg.status || '尚未配对';
})();
document.querySelector('#bind').onclick=async()=>{
  status.textContent='正在连接…';
  const result=await chrome.runtime.sendMessage({type:'astra-bind',endpoint:document.querySelector('#endpoint').value.trim(),token:document.querySelector('#token').value.trim()});
  status.textContent=result.error || (await chrome.storage.local.get('status')).status;
};
document.querySelector('#pause').onclick=async()=>{
  const result=await chrome.runtime.sendMessage({type:'astra-pause'});
  status.textContent=result.error || '已暂停；登录状态保持不变';
};
