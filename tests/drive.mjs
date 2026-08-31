import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('/Users/lucianolupo/projects/micro-tribunal/index.html','utf8');
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
                              resources:'usable', url:'https://local/' });
const { window } = dom;
const d = window.document;
const errs = [];
window.addEventListener('error', e => errs.push('ERROR: ' + e.message));
window.onerror = (m) => errs.push('onerror: ' + m);

const wait = ms => new Promise(r => setTimeout(r, ms));
const q  = s => d.querySelector(s);
const txt = () => d.querySelector('#sbody').textContent.replace(/\s+/g,' ').trim();
const foot= () => d.querySelector('#sfoot').textContent.replace(/\s+/g,' ').trim();
const nev = () => d.querySelector('#cnt').textContent;
const click = s => { const e = q(s); if(!e) throw new Error('NO EXISTE: '+s); e.click(); };

const checks = [];
const check = (name, cond, extra='') =>
  checks.push({name, ok: !!cond, extra: cond ? '' : extra});

await wait(200);

// ── 1. catálogo ─────────────────────────────────────────
check('catálogo renderiza 3 productos', d.querySelectorAll('[data-prod]').length === 3);
check('consola arranca con 1 evento', nev().startsWith('1'), nev());

// ── 2. elegir producto → checkout ───────────────────────
click('[data-prod="zap"]');
await wait(60);
check('checkout muestra el producto', txt().includes('Zapatillas'), txt().slice(0,90));
check('checkout muestra el total en USDC', txt().includes('38.20 USDC'), txt().slice(0,200));
check('botón de pago presente', foot().includes('Bloquear'), foot());

// ── 3. pagar → garantía ─────────────────────────────────
click('[data-act="pagar"]');
await wait(3400);
check('llega a garantía activa', txt().includes('Garantía activa'), txt().slice(0,110));
check('consola loguea approveUsdc',
      d.querySelector('#console').textContent.includes('approveUsdc'));
check('consola loguea Garantia.abrir',
      d.querySelector('#console').textContent.includes('Garantia.abrir'));

// ── 4. abrir disputa ────────────────────────────────────
click('[data-act="reclamo"]');
await wait(60);
check('form de disputa con 4 motivos', d.querySelectorAll('#motivo option').length === 4);
check('botón enviar arranca DESHABILITADO', q('#benv').disabled === true);
check('3 filas de evidencia', d.querySelectorAll('[data-ev]').length === 3);

click('[data-ev="foto"]');
await wait(30);
check('adjuntar evidencia habilita el envío', q('#benv').disabled === false);
click('[data-ev="chat"]');
await wait(30);

// ── 5. enviar → sorteo de jurados ───────────────────────
click('[data-act="enviar"]');
await wait(4200);
check('caso abierto en el teléfono', txt().includes('Caso #4417'), txt().slice(0,110));
check('5 jurados sorteados y activos',
      d.querySelectorAll('.juror.act').length === 5,
      'act=' + d.querySelectorAll('.juror.act').length);
check('el panel del tribunal cambió de estado',
      q('#jstatus').textContent.includes('sorteado'), q('#jstatus').textContent);
check('evidencia contada: 2 archivos', txt().includes('2 archivos'), txt());

// ── 6. vista JURADO ─────────────────────────────────────
[...d.querySelectorAll('.persona')].find(b=>b.dataset.p==='juror').click();
await wait(60);
check('el jurado ve el caso', txt().includes('Caso #4417'), txt().slice(0,110));
check('el jurado ve SOLO la evidencia adjuntada',
      d.querySelectorAll('#sbody .evrow').length === 2,
      'filas=' + d.querySelectorAll('#sbody .evrow').length);
check('el jurado tiene los dos botones de voto',
      foot().includes('COMPRADOR') && foot().includes('vendedor'), foot());

// ── 7. vista VENDEDOR durante la disputa ────────────────
[...d.querySelectorAll('.persona')].find(b=>b.dataset.p==='seller').click();
await wait(60);
check('el vendedor ve la disputa abierta', txt().includes('Disputa abierta'), txt().slice(0,140));

// ── 8. votar desde el jurado → veredicto ────────────────
[...d.querySelectorAll('.persona')].find(b=>b.dataset.p==='juror').click();
await wait(60);
click('[data-act="votar-buyer"]');
await wait(5600);
check('veredicto 4–1 en el panel', q('#verdict').textContent.includes('4–1'),
      q('#verdict').textContent.slice(0,120));
check('el panel marca el fallo', q('#jstatus').textContent.includes('4–1'), q('#jstatus').textContent);
check('4 jurados votaron comprador', d.querySelectorAll('.juror.buyer').length === 4,
      'buyer=' + d.querySelectorAll('.juror.buyer').length);
check('1 jurado votó vendedor', d.querySelectorAll('.juror.seller').length === 1);
check('la barra de votos se llenó', q('#vb').style.width === '80%', q('#vb').style.width);
check('teléfono muestra el fallo a favor', txt().includes('Fallo a tu favor'), txt().slice(0,110));

// ── 9. cobrar en pesos ──────────────────────────────────
click('[data-act="cobrar"]');
await wait(80);
check('pantalla de QR', txt().includes('MercadoPago'), txt().slice(0,110));
check('el QR se generó como SVG', !!q('.qr') && q('.qr').src.startsWith('data:image/svg+xml'));

click('[data-act="escanear"]');
await wait(4200);
check('pesos acreditados', txt().includes('45.000 acreditados'), txt().slice(0,110));
check('orden marcada COMPLETED', txt().includes('COMPLETED'));
const c = d.querySelector('#console').textContent;
check('consola loguea placeOrder PAY', c.includes("orderType: 'pay'"));
check('consola loguea setSellOrderUpi', c.includes('setSellOrderUpi'));
check('consola loguea parseQR', c.includes('parseQR'));
check('consola loguea recipientAddr: zeroAddress', c.includes('zeroAddress'));

// ── 10. reset ───────────────────────────────────────────
click('[data-act="reset"]');
await wait(120);
check('reset vuelve al catálogo', d.querySelectorAll('[data-prod]').length === 3);
check('reset limpia el tribunal', q('#verdict').textContent.includes('Ningún caso abierto'));
check('reset limpia la consola', nev().startsWith('1'), nev());
check('reset limpia los votos', d.querySelectorAll('.juror.buyer,.juror.seller').length === 0);

// ── 11. camino feliz (sin disputa) ──────────────────────
click('[data-prod="cel"]');
await wait(60);
check('segundo producto: iPhone', txt().includes('iPhone'), txt().slice(0,80));
click('[data-act="pagar"]');
await wait(3400);
click('[data-act="recibi"]');
await wait(80);
check('camino feliz libera la plata', txt().includes('Plata liberada'), txt().slice(0,110));
check('menciona el 97 %', txt().includes('97 %'));

// ── informe ─────────────────────────────────────────────
const bad = checks.filter(c => !c.ok);
console.log('\n' + '─'.repeat(64));
for (const c of checks) console.log(`${c.ok?'✅':'❌'}  ${c.name}${c.extra?'\n      → '+c.extra:''}`);
console.log('─'.repeat(64));
console.log(`${checks.length - bad.length}/${checks.length} checks OK`);
if (errs.length) { console.log('\nERRORES JS:'); errs.forEach(e=>console.log('  '+e)); }
else console.log('sin errores de JS en runtime');
process.exit(bad.length || errs.length ? 1 : 0);
