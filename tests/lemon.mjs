import { spawn } from 'child_process'; import fs from 'fs';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ch=spawn(CH,['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-port=9340',
  '--window-size=1440,900','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(1800);
const list=await (await fetch('http://127.0.0.1:9340/json/list')).json();
const ws=new (await import('ws')).WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.once('open',r));
let id=0; const pend=new Map();
ws.on('message',m=>{const d=JSON.parse(m);if(pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id)}});
const send=(m,p={})=>new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method:m,params:p}))});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text};
await send('Page.enable');
await send('Page.navigate',{url:'https://lemon.me'});
await sleep(6000);

const shot=async f=>{const r=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('shots/'+f,Buffer.from(r.result.data,'base64'));console.log('  → shots/'+f)};
await shot('lemon-1.png');

console.log('\n=== TOKENS EXTRAIDOS DE lemon.me ===');
console.log(await ev(`
(() => {
  const c = new Map(), f = new Map(), r = new Map(), sz = new Map();
  const bump=(m,k)=>{ if(!k) return; m.set(k,(m.get(k)||0)+1) };
  document.querySelectorAll('*').forEach(el=>{
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    if(b.width*b.height < 60) return;
    bump(c, s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? 'bg '+s.backgroundColor : null);
    bump(c, 'fg '+s.color);
    bump(f, s.fontFamily.split(',')[0].replace(/["']/g,''));
    if(parseFloat(s.borderRadius) > 0) bump(r, s.borderTopLeftRadius);
    if(b.height > 24) bump(sz, s.fontSize+' / '+s.fontWeight);
  });
  const top=(m,n)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n)
      .map(([k,v])=>'   '+String(v).padStart(4)+'x  '+k).join('\\n');
  return 'COLORES\\n'+top(c,16)+'\\n\\nFUENTES\\n'+top(f,6)+
         '\\n\\nRADIOS\\n'+top(r,8)+'\\n\\nTAMANOS/PESO\\n'+top(sz,12);
})()`));
console.log('\n=== TITULO / COPY ===');
console.log(await ev(`[...document.querySelectorAll('h1,h2')].slice(0,8).map(h=>h.tagName+': '+h.textContent.trim().slice(0,90)).join('\\n')`));
ws.close(); ch.kill();
