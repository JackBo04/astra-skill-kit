import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';

process.umask(0o077);
const codeRoot = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.CHATGPT_BROWSER_HOME || path.join(process.env.HOME, '.local/share/codex-chatgpt-browser');
for (const name of ['run', 'logs']) fs.mkdirSync(path.join(base, name), {recursive:true,mode:0o700});
const configPath = path.join(base, 'run/config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {
  token: crypto.randomBytes(24).toString('hex'), password: crypto.randomBytes(4).toString('hex'),
  webPort: 6080, vncPort: 5907, display: 97,
};
fs.writeFileSync(configPath, JSON.stringify(config), {mode: 0o600});
const bin = path.join(base, 'sysroot/usr/bin');
const env = {...process.env,
  DISPLAY: `:${config.display}`, XAUTHORITY: path.join(base, 'run/Xauthority'),
  LD_LIBRARY_PATH: [path.join(base,'sysroot/usr/lib/x86_64-linux-gnu'), path.join(base,'sysroot/lib/x86_64-linux-gnu'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  PLAYWRIGHT_BROWSERS_PATH: path.join(base, 'browsers'),
  FONTCONFIG_FILE: path.join(base,'fonts.conf'),
  PATH: bin + ':' + process.env.PATH,
};
process.env.PLAYWRIGHT_BROWSERS_PATH = env.PLAYWRIGHT_BROWSERS_PATH;
fs.writeFileSync(env.FONTCONFIG_FILE, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${base}/sysroot/usr/share/fonts</dir><dir>/usr/share/fonts</dir><cachedir>${base}/run/font-cache</cachedir></fontconfig>`);
const children = [];
let web, ipc;
let stopping = false;
const socketPath = path.join(base, 'run/control.sock');
const log = (message) => console.log(new Date().toISOString(), message);
async function pasteManually(text) {
  if(typeof text!=='string' || !text.length || Buffer.byteLength(text)>65536)throw new Error('请输入文字，长度最多为 64 KB。');
  await new Promise((resolve,reject)=>{
    const child=spawn(path.join(bin,'xclip'),['-selection','clipboard','-in'],{env,stdio:['pipe','ignore','ignore']});
    child.on('error',()=>reject(new Error('剪贴板暂时不可用。')));
    child.stdin.on('error',()=>reject(new Error('剪贴板暂时不可用。')));
    child.on('exit',code=>code===0?resolve():reject(new Error('剪贴板暂时不可用。')));
    child.stdin.end(text);
  });
  try {execFileSync(path.join(bin,'xdotool'),['key','--clearmodifiers','ctrl+v'],{env,stdio:'ignore',timeout:5000});}
  catch {throw new Error('请先点击远程输入框，再粘贴。');}
}
function launch(name, args) {
  const fd = fs.openSync(path.join(base,'logs',name+'.log'), 'a', 0o600);
  const child = spawn(name==='Xvfb-local' ? (process.env.ASTRA_XVFB || 'Xvfb') : path.join(bin,name), args, {env, cwd:bin, stdio:['ignore',fd,fd]});
  fs.closeSync(fd);
  children.push(child);
  child.on('error', e => {log(`${name}: ${e.message}`); shutdown(1);});
  child.on('exit', (code) => {if(!stopping){log(`${name} exited ${code}`); shutdown(1);}});
  return child;
}
async function waitFor(check, timeout=15000) {
  const deadline = Date.now()+timeout;
  while(Date.now()<deadline) {if(await check()) return; await new Promise(r=>setTimeout(r,200));}
  throw new Error('Timed out waiting for browser service');
}
function portReady(port) {return new Promise(resolve=>{
  const s=net.connect({host:'127.0.0.1',port});
  s.on('connect',()=>{s.destroy();resolve(true);}); s.on('error',()=>resolve(false));
});}
async function shutdown(code=0) {
  if(stopping) return; stopping=true;
  web?.close(); ipc?.close();
  const timer=setTimeout(()=>process.exit(code),5000); timer.unref();
  for(const child of children.reverse()) child.kill('SIGTERM');
  try {fs.unlinkSync(socketPath);} catch {}
  process.exit(code);
}
process.on('SIGTERM',()=>shutdown()); process.on('SIGINT',()=>shutdown());
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>服务器专用浏览器</title>
<style>body{margin:0;background:#15191f;color:#eee;font:14px system-ui}header{padding:10px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}#screen{height:calc(100vh - 64px)}button{padding:6px 12px;cursor:pointer}#status{color:#b9d6ed}dialog{width:min(440px,85vw);border:0;border-radius:12px;padding:24px;color:#17212b}dialog::backdrop{background:#0008}textarea{box-sizing:border-box;width:100%;height:100px;margin:12px 0;padding:10px;font:16px system-ui}textarea.masked{-webkit-text-security:disc}.actions{display:flex;gap:12px;justify-content:flex-end;margin-top:18px}#paste-error{color:#b42318;min-height:20px}</style>
<header><strong>服务器专用浏览器</strong><span id="status">正在连接…</span><button id="reconnect">重新连接</button><button id="paste">粘贴文字</button></header><div id="screen"></div>
<dialog id="paste-dialog"><strong>粘贴到远程输入框</strong><p>先在远程画面中点选输入框，再把文字粘贴到这里。</p><textarea id="paste-text" class="masked" aria-label="要粘贴的文字" autocomplete="off" spellcheck="false" placeholder="在这里使用 Ctrl+V 或 ⌘V"></textarea><label><input id="show-text" type="checkbox"> 显示文字</label><div id="paste-error" role="status"></div><div class="actions"><button id="paste-cancel">取消</button><button id="paste-send">填入输入框</button></div></dialog>
<script type="module">import RFB from './novnc/core/rfb.js';
const rfb = new RFB(document.querySelector('#screen'),(location.protocol==='https:'?'wss://':'ws://')+location.host+location.pathname.replace(/index.html$/,'')+'websockify',{credentials:{password:${JSON.stringify(config.password)}}});
rfb.scaleViewport=true; rfb.resizeSession=false;
rfb.addEventListener('connect',()=>document.querySelector('#status').textContent='已连接 · 请在下面的浏览器中登录 ChatGPT');
rfb.addEventListener('disconnect',()=>document.querySelector('#status').textContent='连接已断开，可点击重新连接');
document.querySelector('#reconnect').onclick=()=>location.reload();
const dialog=document.querySelector('#paste-dialog'), field=document.querySelector('#paste-text'), error=document.querySelector('#paste-error');
const endpoint=new URL('paste',location.href);
async function sendText(text){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'粘贴失败，请重试');
 document.querySelector('#status').textContent='已填入文字 · 请在远程画面中继续';
}
function resetDialog(){field.value='';field.classList.add('masked');document.querySelector('#show-text').checked=false;error.textContent='';}
document.querySelector('#paste').onclick=()=>{resetDialog();dialog.showModal();field.focus();};
document.querySelector('#show-text').onchange=e=>field.classList.toggle('masked',!e.target.checked);
document.querySelector('#paste-cancel').onclick=()=>dialog.close();
dialog.addEventListener('close',resetDialog);
document.querySelector('#paste-send').onclick=async()=>{
 const button=document.querySelector('#paste-send');button.disabled=true;error.textContent='';
 try{await sendText(field.value);dialog.close();rfb.focus();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}
};
document.addEventListener('paste',event=>{
 if(dialog.open)return;
 const text=event.clipboardData?.getData('text/plain');if(!text)return;
 event.preventDefault();event.stopImmediatePropagation();
 sendText(text).then(()=>rfb.focus()).catch(e=>{document.querySelector('#status').textContent=e.message;});
},true);
</script></html>`;

async function main() {
  if(await portReady(config.webPort) || await portReady(config.vncPort)) throw new Error('Configured port already in use');
  if(fs.existsSync(`/tmp/.X${config.display}-lock`)) throw new Error('Configured virtual display already in use');
  execFileSync('/usr/bin/xauth',['-f',env.XAUTHORITY,'add',env.DISPLAY,'.',crypto.randomBytes(16).toString('hex')],{env,stdio:'ignore'});
  execFileSync(path.join(bin,'x11vnc'),['-storepasswd',config.password,path.join(base,'run/vnc.pass')],{env,stdio:'ignore'});
  const xkbRoot=path.join(base,'sysroot/usr/share/X11/xkb');
  launch('Xvfb-local',[env.DISPLAY,'-screen','0','1440x960x24','-nolisten','tcp','-auth',env.XAUTHORITY,
    ...(fs.existsSync(xkbRoot)?['-xkbdir',xkbRoot]:[]),'-noreset']);
  await waitFor(()=>fs.existsSync(`/tmp/.X11-unix/X${config.display}`));
  launch('x11vnc',['-display',env.DISPLAY,'-auth',env.XAUTHORITY,'-rfbport',String(config.vncPort),'-listen','127.0.0.1','-no6','-rfbauth',path.join(base,'run/vnc.pass'),'-forever','-shared','-noxdamage','-repeat']);
  await waitFor(()=>portReady(config.vncPort));
  {
    const fd=fs.openSync(path.join(base,'logs/manual-chrome.log'),'a',0o600);
    const child=spawn(process.env.ASTRA_CHROME || '/opt/google/chrome/chrome',[
      '--user-data-dir='+path.join(base,'profile-manual'),
      '--no-first-run','--no-default-browser-check','--window-size=1440,960','--window-position=0,0',
      '--disable-dev-shm-usage',...(process.env.ASTRA_ALLOW_NO_SANDBOX==='1'?['--no-sandbox']:[]),
      fs.existsSync(path.join(base,'run/astra-project.json')) ? JSON.parse(fs.readFileSync(path.join(base,'run/astra-project.json'))).url : 'https://chatgpt.com/',
    ],{env,stdio:['ignore',fd,fd]});
    fs.closeSync(fd);children.push(child);
    child.on('error',e=>{log('Manual Chrome: '+e.message);shutdown(1);});
    child.on('exit',code=>{if(!stopping){log('Manual Chrome exited '+code);shutdown(1);}});
  }
  const prefix = '/'+config.token+'/';
  web=http.createServer(async(req,res)=>{
    const pathname = new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    if(!pathname.startsWith(prefix)){res.writeHead(404);return res.end('Not found');}
    const relative=pathname.slice(prefix.length);
    if(relative==='paste'){
      if(req.method!=='POST' || req.headers['content-type']!=='application/json' || req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end();}
      res.setHeader('Content-Type','application/json; charset=utf-8');
      try {
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>400000)throw new Error('粘贴内容过长。');}
        const {text}=JSON.parse(raw);
        await pasteManually(text);
        return res.end(JSON.stringify({ok:true}));
      }catch(e){res.statusCode=400;return res.end(JSON.stringify({error:e.message}));}
    }
    if(relative==='' || relative==='index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
    if(!relative.startsWith('novnc/')){res.writeHead(404);return res.end();}
    const root=path.join(codeRoot,'node_modules/@novnc/novnc');
    const file=path.resolve(root,relative.slice(6));
    if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:4*1024*1024});
  web.on('upgrade',(req,socket,head)=>{
    if(req.url!==prefix+'websockify' || (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>{
      const tcp=net.connect(config.vncPort,'127.0.0.1');
      ws.on('message',data=>tcp.write(data)); tcp.on('data',data=>{if(ws.readyState===1)ws.send(data);});
      ws.on('close',()=>tcp.destroy());ws.on('error',()=>tcp.destroy());
      tcp.on('close',()=>ws.close());tcp.on('error',()=>ws.close());
    });
  });
  await new Promise((resolve,reject)=>{web.once('error',reject);web.listen(config.webPort,'127.0.0.1',resolve);});
  if(fs.existsSync(socketPath))fs.unlinkSync(socketPath);
  ipc=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    try {
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024*1024)throw new Error('Request too large');}
      const command=JSON.parse(raw||'{}');
      if(command.action==='status')return res.end(JSON.stringify({mode:'manual-login',browser:'Google Chrome',automationAttached:false}));
      throw new Error('Use desktop.py for visible browser actions.');
    }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
  });
  await new Promise((resolve,reject)=>{ipc.once('error',reject);ipc.listen(socketPath,resolve);});
  fs.chmodSync(socketPath,0o600);
  fs.writeFileSync(path.join(base,'run/access-url.txt'),`http://127.0.0.1:${config.webPort}${prefix}index.html\n`,{mode:0o600});
  fs.writeFileSync(path.join(base,'run/server.pid'),String(process.pid));
  log('Browser and local remote-desktop endpoint ready');

}
main().catch(e=>{log(e.stack);shutdown(1);});
