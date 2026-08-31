import { JSDOM } from 'jsdom'; import fs from 'fs';
const html = fs.readFileSync('/Users/lucianolupo/projects/micro-tribunal/deck.html','utf8');
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://local/'});
const {window}=dom, d=window.document; const errs=[];
window.HTMLElement.prototype.scrollIntoView = function(){};   // jsdom no lo implementa
window.onerror=(m)=>errs.push(m);
await new Promise(r=>setTimeout(r,200));
const S=[...d.querySelectorAll('.s')];
const checks=[]; const ck=(n,c,e='')=>checks.push({n,ok:!!c,e:c?'':e});

ck('8 slides (la mitad de los 15 originales)', S.length===8, 'n='+S.length);
ck('contador total dice 8', d.querySelector('#tot').textContent==='8');
ck('arranca en 1', d.querySelector('#cur').textContent==='1');
ck('cada slide tiene cabecera', S.every(s=>s.querySelector('.cab')));
ck('cada slide tiene cuerpo',   S.every(s=>s.querySelector('.cuerpo')));
ck('cada slide tiene pie',      S.every(s=>s.querySelector('.pie')));
// la clase .s no se reusa para otra cosa (el bug que ya nos mordio dos veces)
ck('ningun .s que no sea un slide', S.every(s=>s.tagName==='SECTION'),
   'no-section: '+S.filter(s=>s.tagName!=='SECTION').length);

// navegacion
const key=k=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
key('ArrowRight'); await new Promise(r=>setTimeout(r,30));
ck('→ avanza', d.querySelector('#cur').textContent==='2', d.querySelector('#cur').textContent);
key('End'); await new Promise(r=>setTimeout(r,30));
ck('End va a la ultima', d.querySelector('#cur').textContent==='8');
key('ArrowRight'); await new Promise(r=>setTimeout(r,30));
ck('no pasa de la ultima', d.querySelector('#cur').textContent==='8');
key('Home'); await new Promise(r=>setTimeout(r,30));
ck('Home vuelve a la 1', d.querySelector('#cur').textContent==='1');
key('ArrowLeft'); await new Promise(r=>setTimeout(r,30));
ck('no baja de la primera', d.querySelector('#cur').textContent==='1');
d.querySelector('#next').click(); await new Promise(r=>setTimeout(r,30));
ck('boton › funciona', d.querySelector('#cur').textContent==='2');
d.querySelector('#prev').click(); await new Promise(r=>setTimeout(r,30));
ck('boton ‹ funciona', d.querySelector('#cur').textContent==='1');

const T = d.body.textContent.replace(/\s+/g,' ');
// los numeros que SI tienen que estar (los de marketing)
for (const v of ['3.308','36','82 %','55','1.000+','18 s','97 %'])
  ck(`cita ${v}`, T.includes(v));
// y los que NO: el deck de marketing no debe tener jerga tecnica
for (const v of ['zeroAddress','setSellOrderUpi','placeOrder','disputeFaultType','Solidity','SdkProvider','raiseDispute'])
  ck(`SIN jerga tecnica: ${v}`, !T.includes(v), 'aparece '+v);
// y ninguna cifra que ya sabemos incorrecta
ck('sin el 44,3 % refutado', !T.includes('44,3'));

ck('regla @page para PDF', html.includes('@page'));
ck('nav oculta al imprimir', /@media print[\s\S]*?\.nav,\.hint,\.prog\{display:none\}/.test(html));

const bad=checks.filter(c=>!c.ok);
console.log('\n'+'─'.repeat(58));
for(const c of checks) console.log(`${c.ok?'✅':'❌'}  ${c.n}${c.e?'  → '+c.e:''}`);
console.log('─'.repeat(58));
console.log(`${checks.length-bad.length}/${checks.length} checks OK`);
console.log(errs.length ? 'ERRORES JS: '+errs.join(' | ') : 'sin errores de JS');
process.exit(bad.length||errs.length?1:0);
