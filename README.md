# p2p.law — el tribunal que le falta al comercio P2P

Entregables para el hackathon **Builder Break × P2P.me**.
Dos archivos HTML autocontenidos: se abren con doble clic, no necesitan servidor,
no hacen un solo request a la red.

| Archivo | Qué es | Cómo se abre |
|---|---|---|
| `index.html` | Descripción del proyecto + **demo interactiva** de los 3 flujos | `open index.html` |
| `deck.html` | **Deck de 8 slides** — el que se presenta. Marketing, no ingeniería | `open deck.html` |
| `deck-tecnico.html` | La versión larga de 15 slides, con arquitectura y alcance. De respaldo, para preguntas del jurado | `open deck-tecnico.html` |
| `verificar-numeros.py` | Reproduce todos los números del pitch contra el subgraph público | `/opt/homebrew/bin/python3 verificar-numeros.py` |

```bash
open index.html      # la demo
open deck.html       # el deck que se presenta (8 slides)
```

**Dos decks a propósito.** `deck.html` son 8 slides y es el que se presenta: cuenta el problema
y la promesa, sin una sola línea de código. `deck-tecnico.html` son los 15 originales y queda
de respaldo para cuando un jurado pregunte "¿y cómo lo construís?". El detalle técnico completo
vive en `index.html`, que es donde lo van a buscar.

**Navegación**: flechas ← → o barra espaciadora. **`P` exporta a PDF**
(en el diálogo de impresión: destino “Guardar como PDF”, márgenes “ninguno”,
y tildar “gráficos de fondo”).

---

## El sistema visual

Tomado de **lemon.me** — extraído de la página real, no de memoria
(`.tests/lemon.mjs` lo vuelve a medir cuando quieras):

| Token | Valor | Dónde |
|---|---|---|
| Lima | `#CFFF2E` | acento, resaltados, píldoras, fondos de slide |
| Verde bosque | `#003D1B` | slides invertidos, chips de estado |
| Tinta | `#121212` | texto y botones primarios |
| Papel cálido | `#F5F4F0` | tarjetas y secciones alternas |
| Tipografía | **Geist** 800/900 display, 400/500 texto | Google Fonts |
| Radios | 17px tarjetas · 24px bloques · 100px píldoras | |

**La regla que no se rompe:** el lima nunca es texto sobre fondo claro —
sólo relleno. `#CFFF2E` sobre blanco no llega a contraste legible.
Como texto aparece únicamente sobre tinta o verde bosque.

**El teléfono y la consola quedan oscuros a propósito.** Es una captura de app
sobre una página clara, el mismo recurso que usa Lemon. Tienen su propia paleta
scopeada en CSS (`.phone, .console`) para no heredar la clara.

---

## Lo que hace la demo

Tres flujos, todos jugables, sin backend y sin contratos desplegados:

- **Comprador** — elige un producto, bloquea USDC en garantía, ve el reloj de la ventana
  de devolución, sube evidencia y abre la disputa.
- **Jurado** — le toca el caso por sorteo, ve la evidencia de ambas partes,
  vota con su stake en juego.
- **Reembolso** — el fallo libera el escrow, se coloca la orden `PAY`, se escanea
  el QR de MercadoPago y acreditan los pesos.

La **consola de eventos** de la derecha muestra, paso por paso, qué llamada del SDK
correspondería a cada acción, y las marca con distinto color:

- 🔵 `SDK` — llamada real de `@p2pdotme/sdk`, con la forma exacta verificada contra la 1.2.22
- 🟠 `MOCK` — contrato propio, simulado en el cliente
- 🟢 confirmación

Esa distinción explícita es deliberada: un jurado de hackathon valora mucho más
que digas qué está mockeado a que se lo tenga que preguntar.

---

## ⚠️ La corrección técnica importante

El brief original asume que `placeOrder` **“pausa los fondos en custodia durante la compra”**.
Leyendo el SDK y el subgraph, eso no es así, y cambia la arquitectura:

> Una orden de P2P.me es un **swap fiat ↔ USDC que liquida en ~18 segundos**.
> Su escrow vive segundos, **no los 7 días de una ventana de devolución**.

De ahí se sigue el diseño real:

1. **La garantía comercial vive en un contrato nuestro** (`Garantia.sol`),
   que retiene el USDC durante la ventana de devolución.
2. **P2P.me entra como rail de liquidación del fallo**: el veredicto dispara una orden
   `PAY`, que es *desembolso programático en moneda local sin integración bancaria*.
   Un fallo del tribunal es exactamente eso: un desembolso.
3. **`raiseDispute()` existe y se usa** — pero cubre *“el merchant dijo que pagó y el fiat
   no llegó”*, no *“el producto llegó roto”*. Son **dos capas distintas**, y conviene
   decirlo en el pitch: demuestra que leyeron el protocolo y no el README.

Detalle adicional que rompe el diseño ingenuo: **en `PAY` el destino de pago no viaja
en la colocación**. Se coloca con `recipientAddr: zeroAddress`, y el QR se escanea
*después* de que el merchant acepta, vía `setSellOrderUpi`.

---

## Los números del pitch — todos medidos

Medidos el **2026-08-29** contra el subgraph público de P2P.me (Goldsky) y contra
`@p2pdotme/sdk@1.2.22` bajado de npm. Ninguno es estimado. Reproducibles:

```bash
/opt/homebrew/bin/python3 verificar-numeros.py
```

| Dato | Valor | Campo |
|---|---|---|
| Órdenes históricas en la red | **701.252** | `orders_collection` |
| Disputas on-chain, toda la historia | **3.306** (0,47 %) | `disputePlacedAt > 0` |
| Direcciones que las fallaron | **36** — 5 concentran el **82,5 %** | `disputeSettledByAddr` |
| Reparto de culpa (sobre las 1.845 que la registran) | **39,6 % BANK** (falló el rail) · 38,2 % vendedor · 22,0 % comprador | `disputeFaultType` 1=USER 2=MERCHANT 3=BANK |
| Disputas sin tipo de culpa en el índice | 1.463 — **todas órdenes legacy**, artefacto de migración | `isLegacyOrder = true` |
| Apelaciones en toda la historia | **55** (1,7 % de las disputas) | `appealedAt` |
| Mediana de resolución | **30 min** · p90 **10,5 h** · peor caso **35,8 días** | `disputeSettledAt − disputePlacedAt` |
| Disputas sobre órdenes `PAY` | **38,7 %** | `type = 2` |

**El argumento que arman estos números**: P2P.me ya tiene toda la contabilidad de una
disputa on-chain — el botón, los campos, el estado, la apelación. Lo que **no** tiene es
*quién falla, con qué regla y con qué incentivo para fallar bien*. Hoy eso es un puñado
de llaves de admin. Ese es el hueco.

---

## Cosas a decidir antes de presentar

- **El dominio.** `p2p.law` es un dominio real de un TLD real (`.law`, que existe y
  está abierto). **Nadie verificó todavía si está libre ni cuánto sale** — chequealo
  antes de imprimirlo en cualquier lado. Los `.law` suelen ser más caros que un `.com`.
- **Los tres productos del catálogo** de la demo son placeholders — cambialos por
  algo del vertical que quieran contar.
- **La dirección de contacto / equipo** no está en el deck todavía (slide 15).

## El único gate que no se resuelve programando

Colocar una orden `PAY` **real** requiere una wallet con USDC en Base.
Conseguila el primer día, no el último: es lo único de la lista que no se destraba
escribiendo código más rápido.

---

## Verificado

- **Demo** — 41 checks recorriendo los 3 flujos de punta a punta (jsdom), sin errores de JS.
- **Deck** — 31 checks: 8 slides, navegación por teclado y botones, cifras del pitch presentes,
  **ausencia verificada de jerga técnica** (el deck de marketing no debe nombrar `placeOrder`,
  `zeroAddress`, Solidity…), y regla `@page` para PDF.
- **Layout** — los 8 slides medidos en Chrome headless a 1600×900: **ninguno desborda su marco**.
- **Números** — reproducibles con `verificar-numeros.py` contra el subgraph de producción.
