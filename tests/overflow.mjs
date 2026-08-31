import { spawn } from 'child_process';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ch=spawn(CH,['--headless=new','--disable-gpu','--hide-scrollbars',
  '--remote-debugging-port=9334','--window-size=1600,900','--no-first-run',
  '--no-default-browser-check','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(1800);
const list=await (await fetch('http://127.0.0.1:9334/json/list')).json();
const ws=new (await import('ws')).WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.once('open',r));
let id=0; const pend=new Map();
ws.on('message',m=>{const d=JSON.parse(m);if(pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id)}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pend.set(n,r);
  ws.send(JSON.stringify({id:n,method,params}))});
await send('Page.enable');
await send('Page.navigate',{url:'file://'+process.argv[2]});
await sleep(3500);
const r=await send('Runtime.evaluate',{returnByValue:true,expression:`
(() => {
  const out=[];
  document.querySelectorAll('.s').forEach((s,i)=>{
    const c=s.querySelector('.cuerpo');
    const over = c.scrollHeight - c.clientHeight;
    const wide = c.scrollWidth - c.clientWidth;
    // ¿algún hijo se sale del rectángulo del .in?
    const inb = s.querySelector('.in').getBoundingClientRect();
    let fuera=0;
    c.querySelectorAll('*').forEach(el=>{
      const b=el.getBoundingClientRect();
      if(b.height && (b.top < inb.top-1 || b.bottom > inb.bottom+1)) fuera++;
    });
    if(over>1||wide>1) out.push({slide:i+1, overflowY:over, overflowX:wide, fuera});
  });
  return out;
})()`});
console.log(JSON.stringify(r.result.result.value,null,1));
ws.close(); ch.kill();
