/* ════════════════════════════════════════════════════════════════════
   p2p-rail.js — capa de integración REAL con el rail de P2P.me
   --------------------------------------------------------------------
   Envuelve @p2pdotme/sdk (orders / profile / qr-parsers) sobre viem y una
   wallet inyectada (EIP-1193) en Base mainnet. Expone window.P2PRail.

   Qué es REAL aquí (corre on-chain contra el Diamond de P2P.me):
     · connect()            → conecta wallet + asegura Base mainnet
     · getBalance()         → lee balance/allowance de USDC (createProfile)
     · approveUsdc()        → tx real de approve al Diamond
     · placePayOrder()      → tx real: orden PAY (USDC → fiat local)
     · parsePaymentQR()     → parseo real del QR de cobro (MercadoPago, etc.)
     · setSellOrderUpi()    → tx real: entrega el destino de pago cifrado
     · raiseDispute()       → tx real: abre disputa sobre una orden
     · pollOrder()          → lee el estado real de la orden

   Qué NO vive aquí (no existe contrato desplegado):
     · el escrow con período de garantía (Garantia.sol) y
     · el tribunal de jurados con stake (Tribunal.sol)
   son la capa conceptual de p2p.law; se simulan en index.html y están
   etiquetados como tales.

   CONFIG — valores de producción de P2P.me en Base mainnet, tomados del
   networks.json oficial del subgraph (github.com/p2pdotme/subgraph, bloque
   "base"). El Diamond EIP-2535 y el ReputationManager son reales y están
   desplegados en Base mainnet. El subgraph público de P2P.me no expone un
   endpoint compartido (cada operador despliega el suyo en The Graph Studio);
   sin él, las lecturas de historial que dependen del indexer se degradan,
   pero las escrituras on-chain contra el Diamond funcionan igual.
   ════════════════════════════════════════════════════════════════════ */

import {
  createPublicClient, createWalletClient, custom, http,
  zeroAddress, formatUnits, parseUnits, getAddress,
} from 'https://esm.sh/viem@2.21.55';
import { base } from 'https://esm.sh/viem@2.21.55/chains';
import { createOrders } from 'https://esm.sh/@p2pdotme/sdk@1.2.23/orders';
import { createProfile } from 'https://esm.sh/@p2pdotme/sdk@1.2.23/profile';
import { parseQR } from 'https://esm.sh/@p2pdotme/sdk@1.2.23/qr-parsers';

/* ── CONFIG · Base mainnet ─────────────────────────────────────────── */
const CONFIG = {
  chain: base,                       // Base mainnet · chainId 8453
  rpcUrl: 'https://mainnet.base.org',
  // USDC nativo en Base (Circle) — 6 decimales
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // Diamond EIP-2535 de P2P.me en Base mainnet (networks.json → "base")
  diamondAddress: '0x4cad6eC90e65baBec9335cAd728DDC610c316368',
  // ReputationManager en Base mainnet (para lecturas de reputación / zkkyc)
  reputationManagerAddress: '0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D',
  // Subgraph: cada operador despliega el suyo en The Graph Studio. Si el
  // equipo te pasa el endpoint, pegalo acá; vacío = lecturas de historial
  // degradadas, pero las escrituras on-chain siguen funcionando.
  subgraphUrl: '',
};

const USDC_DECIMALS = 6;

/* ── estado del módulo ─────────────────────────────────────────────── */
let publicClient = null;
let walletClient = null;
let orders = null;
let profile = null;
let account = null;

let logger = () => {};              // index.html engancha la consola acá

function log(kind, msg, badge) { try { logger(kind, msg, badge); } catch (_) {} }

/* neverthrow: ResultAsync.match(onOk, onErr) → Promise<T> */
function unwrap(resultAsync) {
  return resultAsync.match(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
}

function short(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function getEthereum() {
  return typeof window !== 'undefined' ? window.ethereum : undefined;
}

/* ── config / disponibilidad ───────────────────────────────────────── */
function isWalletAvailable() { return !!getEthereum(); }
// Las escrituras on-chain (approve, placeOrder, dispute) solo necesitan el
// Diamond. El subgraph es opcional y solo alimenta lecturas de historial.
function isRailConfigured() { return !!CONFIG.diamondAddress; }
function hasSubgraph() { return !!CONFIG.subgraphUrl; }
function getAccount() { return account; }

function buildClients() {
  publicClient = createPublicClient({ chain: CONFIG.chain, transport: http(CONFIG.rpcUrl) });
  walletClient = createWalletClient({ chain: CONFIG.chain, transport: custom(getEthereum()) });
  if (isRailConfigured()) {
    const cfg = {
      publicClient,
      diamondAddress: getAddress(CONFIG.diamondAddress),
      usdcAddress: getAddress(CONFIG.usdcAddress),
    };
    if (CONFIG.reputationManagerAddress) {
      cfg.reputationManagerAddress = getAddress(CONFIG.reputationManagerAddress);
    }
    // subgraphUrl es opcional: solo lo pasamos si el operador lo configuró.
    if (hasSubgraph()) cfg.subgraphUrl = CONFIG.subgraphUrl;
    orders = createOrders(cfg);
    profile = createProfile({
      publicClient,
      diamondAddress: cfg.diamondAddress,
      usdcAddress: cfg.usdcAddress,
    });
  }
}

/* ── asegurar Base mainnet en la wallet ────────────────────────────── */
async function ensureBaseChain() {
  const eth = getEthereum();
  const hexId = '0x' + CONFIG.chain.id.toString(16); // 0x2105
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
  } catch (err) {
    // 4902 = red desconocida para la wallet → la agregamos
    if (err && (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902))) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hexId,
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [CONFIG.rpcUrl],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw err;
    }
  }
}

/* ── conectar wallet ───────────────────────────────────────────────── */
async function connect() {
  const eth = getEthereum();
  if (!eth) throw new Error('No hay wallet inyectada. Instalá MetaMask, Rabby, Coinbase Wallet u otra.');
  log('sdk', 'wallet.requestAccounts()', 'RAIL');
  const accts = await eth.request({ method: 'eth_requestAccounts' });
  if (!accts || !accts.length) throw new Error('El usuario no autorizó ninguna cuenta.');
  await ensureBaseChain();
  account = getAddress(accts[0]);
  buildClients();
  log('ok', '→ wallet conectada · ' + short(account) + ' · Base mainnet');
  if (!isRailConfigured()) {
    log('err', '→ CONFIG incompleto: falta diamondAddress de P2P.me — escrituras del rail deshabilitadas');
  } else if (!hasSubgraph()) {
    log('sdk', '→ subgraph no configurado: escrituras on-chain activas; historial/routing degradados', 'RAIL');
  }
  return { address: account, configured: isRailConfigured() };
}

/* ── lecturas ──────────────────────────────────────────────────────── */
async function getBalance() {
  if (!profile || !account) return null;
  const r = await unwrap(profile.getUsdcBalance({ userAddress: account }));
  if (!r.ok) { log('err', '→ getUsdcBalance falló: ' + (r.error && r.error.code)); return null; }
  const usdc = Number(formatUnits(r.value, USDC_DECIMALS));
  log('ok', '→ balance USDC: ' + usdc.toFixed(2));
  return usdc;
}

async function getAllowance() {
  if (!profile || !account) return null;
  const r = await unwrap(profile.getUsdcAllowance({ userAddress: account }));
  if (!r.ok) return null;
  return Number(formatUnits(r.value, USDC_DECIMALS));
}

/* ── escrituras (rail real) ────────────────────────────────────────── */
async function approveUsdc(amountUsdc) {
  if (!orders || !walletClient) throw new Error('Rail no configurado o wallet no conectada.');
  const amount = parseUnits(String(amountUsdc), USDC_DECIMALS);
  log('sdk', `orders.approveUsdc.execute({ amount: ${amount}n })`, 'RAIL');
  const r = await unwrap(orders.approveUsdc.execute({ amount, walletClient, waitForReceipt: true }));
  if (!r.ok) throw decorate(r.error);
  log('ok', '→ approve confirmado · ' + short(r.value.hash));
  return r.value;
}

/**
 * Coloca una orden PAY: convierte USDC del usuario a fiat local que paga
 * un merchant de P2P.me. En PAY el destino NO viaja en la colocación.
 */
async function placePayOrder({ amountUsdc, fiatAmount, currency }) {
  if (!orders || !walletClient || !account) throw new Error('Rail no configurado o wallet no conectada.');
  const amount = parseUnits(String(amountUsdc), USDC_DECIMALS);
  const fiat = BigInt(Math.round(fiatAmount * 100)); // fiat a 2 decimales
  log('sdk', `orders.placeOrder.execute({ orderType: 2 (pay), currency: '${currency}', amount: ${amount}n, fiatAmount: ${fiat}n, recipientAddr: zeroAddress })`, 'RAIL');
  const r = await unwrap(orders.placeOrder.execute({
    orderType: 2,
    currency,
    user: account,
    amount,
    fiatAmount: fiat,
    recipientAddr: zeroAddress,
    walletClient,
    waitForReceipt: true,
  }));
  if (!r.ok) throw decorate(r.error);
  const orderId = r.value.meta && r.value.meta.orderId;
  log('ok', '→ orden PAY colocada · ' + short(r.value.hash) + (orderId != null ? ' · orderId ' + orderId : ''));
  return { hash: r.value.hash, orderId };
}

async function pollOrder(orderId, { tries = 40, intervalMs = 3000, onTick } = {}) {
  if (!orders) throw new Error('Rail no configurado.');
  for (let i = 0; i < tries; i++) {
    const r = await unwrap(orders.getOrder({ orderId: BigInt(orderId) }));
    if (r.ok) {
      const o = r.value;
      onTick && onTick(o);
      if (o.status === 'accepted' || o.status === 'paid' || o.status === 'completed') return o;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error('Timeout esperando el avance de la orden ' + orderId);
}

async function parsePaymentQR({ qrData, currency, sellPrice }) {
  log('sdk', `parseQR({ currency: '${currency}', sellPrice: ${sellPrice} })`, 'RAIL');
  const res = await parseQR({ qrData, currency, sellPrice });
  const r = res.match((v) => ({ ok: true, value: v }), (e) => ({ ok: false, error: e }));
  if (!r.ok) throw new Error('QR inválido: ' + (r.error && r.error.code));
  log('ok', '→ QR parseado · destino ' + short(r.value.paymentAddress));
  return r.value;
}

async function setSellOrderUpi({ orderId, paymentAddress, merchantPublicKey, updatedAmount }) {
  if (!orders || !walletClient) throw new Error('Rail no configurado o wallet no conectada.');
  const enc = await unwrap(orders.encryptPaymentAddress({ paymentAddress, recipientPublicKey: merchantPublicKey }));
  if (!enc.ok) throw decorate(enc.error);
  log('sdk', 'orders.setSellOrderUpi.execute({ orderId, encUpi, updatedAmount })', 'RAIL');
  const r = await unwrap(orders.setSellOrderUpi.execute({
    orderId: BigInt(orderId),
    paymentAddress: enc.value,
    merchantPublicKey,
    updatedAmount: parseUnits(String(updatedAmount), USDC_DECIMALS),
    walletClient,
    waitForReceipt: true,
  }));
  if (!r.ok) throw decorate(r.error);
  log('ok', '→ destino entregado al merchant · ' + short(r.value.hash));
  return r.value;
}

async function raiseDispute({ orderId, redactTransId = 0 }) {
  if (!orders || !walletClient) throw new Error('Rail no configurado o wallet no conectada.');
  log('sdk', `orders.raiseDispute.execute({ orderId: ${orderId}n })`, 'RAIL');
  const r = await unwrap(orders.raiseDispute.execute({
    orderId: BigInt(orderId),
    redactTransId: BigInt(redactTransId),
    walletClient,
    waitForReceipt: true,
  }));
  if (!r.ok) throw decorate(r.error);
  log('ok', '→ disputa abierta on-chain · ' + short(r.value.hash));
  return r.value;
}

/* adorna errores del SDK con el mensaje de contrato legible si aplica */
function decorate(err) {
  const e = err instanceof Error ? err : new Error(String(err && err.message || err));
  if (err && err.code) e.code = err.code;
  return e;
}

/* ── API pública ───────────────────────────────────────────────────── */
window.P2PRail = {
  CONFIG,
  setLogger(fn) { logger = typeof fn === 'function' ? fn : (() => {}); },
  isWalletAvailable,
  isRailConfigured,
  getAccount,
  short,
  connect,
  getBalance,
  getAllowance,
  approveUsdc,
  placePayOrder,
  pollOrder,
  parsePaymentQR,
  setSellOrderUpi,
  raiseDispute,
};

/* aviso temprano en consola de la app */
window.dispatchEvent(new CustomEvent('p2prail:ready', {
  detail: { walletAvailable: isWalletAvailable(), configured: isRailConfigured() },
}));
