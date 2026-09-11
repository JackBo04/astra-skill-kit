// Exercise actual extension windows and the real broker on synthetic local pages.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {fixture} from './browser_fixture.mjs';
const require=createRequire(process.env.SELFGUIDE_TEST_MODULE_ROOT || import.meta.url);
const {chromium}=require('playwright');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'selfguide-multi-test-'));
const project='https://chatgpt.com/g/g-p-fixture/project';
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const variant=process.env.SELFGUIDE_TEST_VARIANT || 'server';
const env={...process.env,SELFGUIDE_BRIDGE_HOME:path.join(tmp,'bridge')};
const scripts=path.join(root,`skills/selfguide-${variant}/scripts`);
function session(...args){const r=spawnSync('python',[path.join(scripts,'session.py'),...args],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
const init=spawnSync('python',[path.join(scripts,'bridge.py'),'init','--project-url',project,'--port',String(port)],{env,encoding:'utf8'});assert.equal(init.status,0,init.stderr);
const cfg=JSON.parse(await fs.readFile(path.join(tmp,'bridge/config.json'),'utf8'));
const broker=spawn('python',[path.join(scripts,'bridge.py'),'serve'],{env,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(route,body){
 const r=await fetch(`http://127.0.0.1:${port}`+route,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.agent_token},body:JSON.stringify(body)});
 const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;
}
async function command(task,action,extra={},allowError=false){
 const id=crypto.randomBytes(16).toString('hex');
 await rpc('/command',{id,command:{action,session:task.id,expected_url:task.url,...extra}});
 const end=Date.now()+25000;
 while(Date.now()<end){
  const job=await rpc('/job',{id});
  if(job.state==='done'){if(!allowError)assert.equal(job.result.error,undefined,JSON.stringify(job.result));return job.result;}
  await wait(150);
 }
 throw Error('Command timed out: '+task.id+' '+action);
}
function watch(task){
 const args=['--run',task.run,'--file',task.prompt,'--expect-url',task.url,'--out',path.join(task.run,'checks/watch.json'),'--reply-out',path.join(task.run,'feedback/dom.txt'),'--interval','0.2','--timeout','60'];
 return new Promise(resolve=>{
  const child=spawn('python',[path.join(scripts,'wait_reply.py'),...args],{env});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.on('close',code=>resolve({code,stdout,stderr}));
 });
}
let context;
try {
 await wait(300);
 context=await chromium.launchPersistentContext(path.join(tmp,'profile'),{channel:'chromium',headless:true,viewport:null,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--host-resolver-rules=MAP chatgpt.com 127.0.0.1',`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`]});
 await context.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const legacy=await context.newPage();await legacy.goto(project);await legacy.waitForSelector('#prompt-textarea');await legacy.locator('#prompt-textarea').fill('KEEP THE ORIGINAL DRAFT');
 await worker.evaluate(async cfg=>{
  const [tab]=await chrome.tabs.query({url:'https://chatgpt.com/*'});
  await chrome.storage.local.set({endpoint:cfg.endpoint,token:cfg.token,tabId:tab.id,enabled:true});
 },{endpoint:`http://127.0.0.1:${port}`,token:cfg.browser_token});
 async function newTask(label){
  const file=path.join(tmp,label+'.txt');await fs.writeFile(file,'Task '+label+': use only your own attachment.');
  const run=session('new','--task-file',file,'--workspace',path.join(tmp,'runs')).run;
  const task={id:path.basename(run),run,url:project,marker:crypto.randomBytes(16).toString('hex')};
  const created=context.waitForEvent('page');
  const opened=await command(task,'open');assert.equal(opened.window_opened,true);assert.equal(opened.reused,false);
  task.page=await created;
  // The extension can start navigation before Playwright attaches its route.
  // DNS is blocked above; explicitly revisit after attaching to the new target.
  await task.page.goto(project);await task.page.waitForSelector('#prompt-textarea');
  task.window=opened.window_id;task.tab=opened.tab_id;
  await task.page.evaluate(label=>{window.conversationId=label;window.collapsedMessage=true;},label);
  const prepared=session('prepare','--run',run,'--file',file);task.prompt=prepared.file;task.text=await fs.readFile(task.prompt,'utf8');
  return task;
 }
 const a=await newTask('alpha'),b=await newTask('beta');
 assert.notEqual(a.window,b.window);assert.notEqual(a.tab,b.tab);
 const positions=await worker.evaluate(async ids=>Promise.all(ids.map(id=>chrome.windows.get(id))),[a.window,b.window]);
 assert.ok(positions[0].left!==positions[1].left || positions[0].top!==positions[1].top,'Task windows must not completely cover each other');
 assert.equal(await legacy.locator('#prompt-textarea').inputValue(),'KEEP THE ORIGINAL DRAFT');
 const again=await command(a,'open');assert.equal(again.reused,true);assert.equal(again.window_id,a.window);
 const attach=t=>command(t,'attach',{file:{name:'evidence.txt',mime:'text/plain',base64:Buffer.from(t.marker).toString('base64'),sha256:crypto.createHash('sha256').update(t.marker).digest('hex')}});
 await Promise.all([attach(a),attach(b)]);
 // Lose the first acknowledgement for two different results, after the server saves them.
 await worker.evaluate(()=>{
  const fetchOriginal=globalThis.fetch;globalThis.droppedResults=new Set();
  globalThis.fetch=async(...args)=>{
   const response=await fetchOriginal(...args);
   if(String(args[0]).endsWith('/result')){
    const id=JSON.parse(args[1].body).id;
    if(globalThis.droppedResults.size<2 && !globalThis.droppedResults.has(id)){
     globalThis.droppedResults.add(id);throw Error('Synthetic lost acknowledgement');
    }
   }
   return response;
  };
 });
 await Promise.all([command(a,'compose',{text:a.text}),command(b,'compose',{text:b.text})]);
 assert.equal(await a.page.locator('#prompt-textarea').inputValue(),a.text);
 assert.equal(await b.page.locator('#prompt-textarea').inputValue(),b.text);
 // Long work in A must not monopolize the extension or B's mailbox.
 await a.page.evaluate(()=>window.replyDelay=30000);
 await b.page.evaluate(()=>window.replyDelay=300);
 for(const t of [a,b])session('submitting','--run',t.run);
 const sent=await Promise.all([command(a,'send',{text:a.text}),command(b,'send',{text:b.text})]);
 for(const [i,t] of [a,b].entries()){assert.equal(sent[i].sent,true);t.url=sent[i].url;session('sent','--run',t.run,'--url',t.url);}
 const waitingA=watch(a),doneB=await watch(b);
 assert.equal(doneB.code,0,doneB.stderr);
 assert.equal(await a.page.locator('[data-testid=stop-button]').count(),1,'B should finish while A is still generating');
 const doneA=await waitingA;assert.equal(doneA.code,0,doneA.stderr);
 for(const [t,other] of [[a,b],[b,a]]){
  const reply=await fs.readFile(path.join(t.run,'feedback/dom.txt'),'utf8');
  assert.ok(reply.includes(t.marker));assert.ok(!reply.includes(other.marker));
  session('reply','--run',t.run,'--file',path.join(t.run,'feedback/dom.txt'),'--source','dom');
 }
 const crossed=await command(a,'status',{expected_url:b.url},true);assert.equal(crossed.code,'wrong_page');
 // Simulate a browser restart: stale tab IDs cannot silently take over a new task.
 await worker.evaluate(async id=>{const key='selfguide.session.'+id;const saved=await chrome.storage.local.get(key);await chrome.storage.local.set({[key]:{...saved[key],state:'restart_unverified'}});},a.id);
 assert.equal((await command(a,'status',{},true)).code,'session_not_open');
 assert.equal((await command(b,'status')).assistant_count,1);
 // Closing a task window does not rebind to the active or legacy tab.
 await b.page.close();assert.equal((await command(b,'status',{},true)).code,'window_closed');
 const restoredPage=context.waitForEvent('page');
 const restored=await command(b,'open',{restore:true});
 assert.equal(restored.url,b.url);assert.notEqual(restored.tab_id,b.tab);
 b.page=await restoredPage;await b.page.goto(b.url);await b.page.waitForSelector('#prompt-textarea');
 assert.equal((await command(b,'status')).composer,true);
 assert.equal(await worker.evaluate(()=>globalThis.droppedResults.size),2);
 const c=await newTask('gamma');assert.equal((await command(c,'status')).composer,true);
 assert.equal(await legacy.locator('#prompt-textarea').inputValue(),'KEEP THE ORIGINAL DRAFT');
 const registry=await worker.evaluate(async()=>Object.keys(await chrome.storage.local.get(null)).filter(k=>k.startsWith('selfguide.session.')));
 assert.equal(registry.length,3,'Each window retains its own durable binding');
 // No ChatGPT content heartbeat remains: the worker must still discover new work.
 for(const page of [a.page,b.page,c.page,legacy])await page.close();
 const openedAt=Date.now(),d=await newTask('delta');
 assert.ok(Date.now()-openedAt<12000,'Opening a task should not wait for the fallback alarm');
 assert.equal((await command(d,'status')).composer,true);
 console.log(JSON.stringify({variant,independent_tasks:4,parallel_replies:2,closed_window_restored:true,lost_acknowledgements_recovered:2,other_task_finished_while_first_generating:true,legacy_draft_preserved:true,collapsed_messages:true,open_without_page_heartbeat:true}));
 console.log('PASS: independent windows, scoped mutations, exact attachment/reply routing, watcher task binding, closed/stale window isolation.');
} finally {
 if(context)await context.close();broker.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});
}
