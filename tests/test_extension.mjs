// This is a controlled fixture test. It does not log in to or test live ChatGPT.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(process.env.ASTRA_TEST_MODULE_ROOT || import.meta.url);
const {chromium}=require('playwright');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'astra-extension-test-'));
const project='https://chatgpt.com/g/g-p-fixture/project';
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const env={...process.env,ASTRA_LOCAL_HOME:path.join(tmp,'bridge')};
const bridge=path.join(root,'skills/chatgpt-supervised-local/scripts/bridge.py');
const init=spawnSync('python',[bridge,'init','--project-url',project,'--port',String(port)],{env,encoding:'utf8'});
assert.equal(init.status,0,init.stderr);
const cfg=JSON.parse(await fs.readFile(path.join(tmp,'bridge/config.json'),'utf8'));
const proc=spawn('python',[bridge,'serve'],{env,stdio:'ignore'});
let context;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(route,body,role='agent'){
 const response=await fetch(`http://127.0.0.1:${port}`+route,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg[role+'_token']},body:JSON.stringify(body)});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
async function command(action,extra={}){
 const id=crypto.randomBytes(16).toString('hex');
 await rpc('/command',{id,command:{action,expected_url:await page.url(),...extra}});
 for(let i=0;i<100;i++){
  const job=await rpc('/job',{id});
  if(job.state==='done'){assert.equal(job.result.error,undefined,JSON.stringify(job.result));return job.result;}
  await wait(250);
 }
 throw Error('Fixture command timeout: '+action);
}
const fixture=`<!doctype html><title>Astra test fixture</title><aside>PRIVATE SIDEBAR SHOULD NOT BE READ</aside><main id="messages"></main>
<form><textarea id="prompt-textarea"></textarea><input type="file" hidden><div id="attachments"></div><button type="button" data-testid="send-button">Send</button></form>
<script>
let uploaded='';
document.querySelector('input[type=file]').onchange=async e=>{uploaded=await e.target.files[0].text();document.querySelector('#attachments').innerHTML='<div data-testid="attachment-card">'+e.target.files[0].name+'</div>';};
document.querySelector('[data-testid=send-button]').onclick=()=>{
 const input=document.querySelector('textarea');const article=document.createElement('article');const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.textContent=input.value;article.append(user);document.querySelector('main').append(article);input.value='';document.querySelector('#attachments').innerHTML='';history.replaceState({},'', '/g/g-p-fixture-astra/c/fixture-1');
 const stop=document.createElement('button');stop.dataset.testid='stop-button';document.body.append(stop);
 setTimeout(()=>{const article=document.createElement('article');const assistant=document.createElement('div');assistant.dataset.messageAuthorRole='assistant';assistant.textContent='FIXTURE_ACCEPTED '+uploaded;article.append(assistant);const copy=document.createElement('button');copy.dataset.testid='copy-turn-action-button';copy.textContent='Copy';article.append(copy);document.querySelector('main').append(article);stop.remove();},400);
};
</script>`;
let page;
try{
 await wait(300);
 context=await chromium.launchPersistentContext(path.join(tmp,'profile'),{channel:'chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`]});
 await context.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 page=await context.newPage();await page.goto(project);await page.waitForSelector('#prompt-textarea');
 await worker.evaluate(async cfg=>{
  const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});
  await chrome.storage.local.set({endpoint:cfg.endpoint,token:cfg.token,tabId:tabs[0].id,enabled:true});
 },{endpoint:`http://127.0.0.1:${port}`,token:cfg.browser_token});
 const state=await command('snapshot');assert.equal(state.composer,true);assert.ok(!JSON.stringify(state).includes('PRIVATE SIDEBAR'));
 const bytes=Buffer.from('random fixture marker '+crypto.randomBytes(8).toString('hex'));
 const attached=await command('attach',{file:{name:'probe.txt',mime:'text/plain',base64:bytes.toString('base64'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
 assert.equal(attached.file_paste_requested,true);assert.ok(attached.attachments.some(a=>a.name==='probe.txt'));
 const text='Use only the attached fixture file.';
 const composed=await command('compose',{text});assert.equal(composed.draft,text);
 const sent=await command('send',{text});assert.equal(sent.sent,true);assert.ok(sent.url.includes('/c/'));
 await wait(700);
 const reply=await command('reply',{text});assert.equal(reply.complete,true);assert.ok(reply.text.includes(bytes.toString()));
 const handoff='SELFGUIDE_REPLY_BEGIN task=fixture round=1\n路径 /tmp/a_b；原文 <value> & 中文\nSELFGUIDE_REPLY_END task=fixture round=1';
 await page.evaluate(value=>{
  const assistant=document.querySelector('[data-message-author-role="assistant"]');
  assistant.textContent='请同时核对这段块外说明。';
  const pre=document.createElement('pre'), toolbar=document.createElement('button'),code=document.createElement('code');
  toolbar.textContent='text Copy code';code.textContent=value;pre.append(toolbar,code);assistant.append(pre);
 },handoff);
 const structured=await command('reply',{text});
 assert.equal(structured.handoff_text,handoff);
 assert.ok(structured.text.includes('块外说明'));
 assert.ok(structured.text.includes('Copy code'));
 await command('project');await page.waitForURL(project);
 assert.equal((await command('snapshot')).user_count,0);
 console.log('PASS: real extension service worker + content script + HTTP broker; snapshot, file bytes/hash, compose, send confirmation, reply matching and project navigation on controlled fixture.');
}finally{await context?.close();proc.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
