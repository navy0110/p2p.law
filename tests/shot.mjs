// Captura cada slide del deck navegando con scrollTop, vía Chrome DevTools Protocol.
import { spawn } from 'child_process';
import fs from 'fs';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args=['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-port=9333',
            '--window-size=1600,900','--no-first-run','--no-default-browser-check',
            'about:blank'];
const ch=spawn(CH,args,{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(1800);
const list=await (await fetch('http://127.0.0.1:9333/json/list')).json();
const target=list.find(t=>t.type==='page');
const ws=new (await import('ws')).WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.once('open',r));
let id=0; const pend=new Map();
ws.on('message',m=>{const d=JSON.parse(m);if(pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id)}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pend.set(n,r);
  ws.send(JSON.stringify({id:n,method,params}))});
await send('Page.enable');
await send('Page.navigate',{url:'file:///Users/lucianolupo/projects/micro-tribunal/deck.html'});
await sleep(3500);
const which = process.argv.slice(2).map(Number);
for(const n of which){
  await send('Runtime.evaluate',{expression:
    `document.getElementById('mazo').scrollTo({top:${n-1}*innerHeight,behavior:'instant'})`});
  await sleep(700);
  const r=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(`shots/s${String(n).padStart(2,'0')}.png`,Buffer.from(r.result.data,'base64'));
  console.log('shots/s'+String(n).padStart(2,'0')+'.png');
}
ws.close(); ch.kill();
