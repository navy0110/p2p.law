import { spawn } from 'child_process'; import fs from 'fs';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ch=spawn(CH,['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-port=9341',
  '--window-size=1440,900','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(1700);
const l=await (await fetch('http://127.0.0.1:9341/json/list')).json();
const ws=new (await import('ws')).WebSocket(l.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.once('open',r));
let id=0; const pend=new Map();
ws.on('message',m=>{const d=JSON.parse(m);if(pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id)}});
const send=(m,p={})=>new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method:m,params:p}))});
await send('Page.enable');
await send('Page.navigate',{url:'file:///Users/lucianolupo/projects/micro-tribunal/index.html'});
await sleep(3200);
for (const [name, y] of [['hero',0],['problema',900],['como',1800]]) {
  await send('Runtime.evaluate',{expression:`scrollTo({top:${y},behavior:'instant'})`});
  await sleep(600);
  const r=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(`shots/pag-${name}.png`,Buffer.from(r.result.data,'base64'));
  console.log('shots/pag-'+name+'.png');
}
ws.close(); ch.kill();
