# p2p.law — Un protocolo de resolución de disputas para comercio P2P

Un sistema de tribunal descentralizado para transacciones entre pares en P2P.me. Construido para el hackathon [Builder Break × P2P.me](https://www.p2p.me).

## El Problema

P2P.me gestiona ~700k órdenes anuales con una **tasa de disputa del 0,47 %** (3.306 casos). Hoy, las disputas se resuelven por llaves de admin e intuición. No existe:

- **Un conjunto claro de reglas** para qué constituye error del comprador vs. fraude del vendedor vs. falla de plataforma
- **Estructura de incentivos** — ¿por qué un jurado gastaría esfuerzo en votar correctamente?
- **Registro transparente** — quién decidió qué, con qué evidencia y por qué?

Mientras tanto, la infraestructura on-chain ya existe: `raiseDispute()`, `disputeStatus`, `disputeFaultType`, campos de liquidación. Lo que falta es el sistema de tribunal.

## La Solución

**p2p.law** es un protocolo de jurado que:

1. **Asigna disputas por sorteo** a jurados que bloquean stake (`tokens JURY`)
2. **Obliga presentación de pruebas** — tanto comprador como vendedor presentan evidencia on-chain
3. **Vota con capital en riesgo** — el stake del jurado se corta si vota con la minoría
4. **Liquida vía el rail `PAY` de P2P.me** — el veredicto es un desembolso programático en moneda local, sin transferencias manuales

Tres capas:
- **Comprador**: bloquea garantía USDC, presenta evidencia, espera veredicto
- **Jurado**: es sorteado, vota sobre evidencia, stake en riesgo
- **Liquidación**: veredicto dispara orden `PAY`, vendedor escanea QR, dinero llega a cuenta local

## Decks en Vivo y Demo

| Archivo | Qué es | Abrir con |
|---|---|---|
| **`index.html`** | Demo interactiva de 3 flujos (jugable, sin backend) | `open index.html` o doble clic |
| **`deck.html`** | Pitch de marketing de 8 slides (presenta este) | `open deck.html` |
| **`deck-tecnico.html`** | Deep-dive técnico de 15 slides (respaldo para preguntas del jurado) | `open deck-tecnico.html` |

**Los tres son autocontenidos** — no necesitan servidor, sin requests a la red. Ábrelos en cualquier navegador.

### Demo: Juega los Tres Flujos

- **Flujo comprador** — selecciona producto, bloquea USDC, sube evidencia, abre disputa
- **Flujo jurado** — es sorteado en un caso, revisa evidencia, vota con stake en riesgo
- **Flujo liquidación** — veredicto libera escrow, dispara `PAY`, escanea QR, pesos llegan

El panel derecho muestra paso a paso las llamadas del SDK (llamadas reales de `@p2pdotme/sdk` en 🔵 azul, contratos mockeados en 🟠 naranja, confirmaciones en 🟢 verde).

### Navegación por Teclado

- **Flechas** ← → : navega slides
- **Barra espaciadora**: siguiente slide
- **`P`**: exporta a PDF (Chrome: Imprimir → Guardar como PDF, márgenes: Ninguno, marca "Gráficos de fondo")

## Números Clave (Medidos 2026-08-29)

Todos verificados contra el [subgraph público de P2P.me](https://api.goldsky.com/api/public/project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/prod/gn) y `@p2pdotme/sdk@1.2.22`.

| Métrica | Valor | Insight |
|---|---|---|
| Disputas históricas on-chain | **3.306** | 0,47 % de 701k órdenes |
| Tasa de disputa por tipo de culpa | **39,6 % BANCO**, 38,2 % vendedor, 22 % comprador | Las fallas de plataforma son causa #1 |
| Direcciones que resolvieron disputas | **36** total; 5 direcciones concentran 82,5 % del volumen | Llaves de admin centralizadas hoy |
| Tiempo mediano de resolución | **30 min** (p90: 10,5h, peor caso: 35,8 días) | La velocidad varía muchísimo |
| Disputas tipo `PAY` | **38,7 %** del total | Categoría de disputa más grande |
| Apelaciones en toda la historia | **55** (1,7 % de disputas) | ¿Tasa baja de apelación = problema de confianza? |

**El argumento que arman estos números:** P2P.me ya tiene **la contabilidad** de un sistema de disputa (campos de estado, timestamps, seguimiento de culpa). Lo que le falta es **el tribunal** — un conjunto de reglas, incentivos de jurado y lógica de liquidación transparente.

## Insight de Arquitectura: Qué Corregimos

El brief original asumía que `placeOrder` "pausa fondos en escrow por 7 días". Leyendo el SDK y el subgraph descubrimos el diseño real:

> Las órdenes de P2P.me son **swaps fiat ↔ USDC que se liquidan en ~18 segundos**. Su escrow vive segundos, no días.

Esto cambia todo:

- **Nuestro contrato** (`Garantia.sol`) retiene USDC durante la ventana de devolución (7 días)
- **P2P.me entra en liquidación** — el veredicto dispara una orden `PAY` (desembolso de moneda local programático, sin integración bancaria necesaria)
- **`raiseDispute()` es real pero cubre una capa distinta** — "el vendedor dice que pagó pero fiat no llegó" (falla de rail), no "el producto llegó roto" (disputa de comprador). Dos casos distintos. El pitch menciona esto para mostrar que leyeron el protocolo, no el README.

**Detalle no obvio:** las órdenes `PAY` no codifican el destino del pago en su colocación. Se colocan con `recipientAddr: zeroAddress`, y el QR se escanea *después* de que el vendedor acepta, vía `setSellOrderUpi`.

## Sistema de Diseño

Sourced de **lemon.me** (extraído del sitio en vivo, no de memoria):

| Token | Valor | Uso |
|---|---|---|
| Acento lima | `#CFFF2E` | resaltados, insignias, fondos de slides |
| Verde bosque | `#003D1B` | slides invertidos, chips de estado |
| Tinta | `#121212` | texto, botones primarios |
| Papel cálido | `#F5F4F0` | tarjetas, secciones alternas |
| Fuente | **Geist** 800/900 (display), 400/500 (texto) | Google Fonts |
| Radios de borde | 17px (tarjetas) · 24px (bloques) · 100px (insignias) | — |

**Regla inquebrantable:** Lima nunca es texto sobre fondo claro. Úsalo solo como relleno. Solo aparece como texto sobre tinta o verde bosque.

## Primeros Pasos

### Ver la Demo
```bash
open index.html
```

### Verificar los Números
```bash
python3 verificar-numeros.py
```

Golpea el subgraph en vivo de P2P.me y reproduce cada estadística del pitch.

### Prerrequisitos para Órdenes `PAY` Reales
- USDC en una wallet en **red Base**
- Acceso a `@p2pdotme/sdk@1.2.22` o superior
- Cuenta de vendedor en P2P.me

## Estructura de Archivos

```
.
├── index.html              # Demo interactiva + explicador
├── deck.html               # Pitch de marketing de 8 slides
├── deck-tecnico.html       # Backup técnico de 15 slides
├── verificar-numeros.py    # Reproduce números del pitch desde subgraph
├── README.md               # Este archivo
└── .gitignore
```

## Testing

- **Demo**: 41 checks (jsdom) cubriendo los 3 flujos end-to-end, cero errores JS
- **Deck**: 31 checks — navegación, cantidad de slides, presencia de todos los números del pitch, **ausencia verificada de jerga técnica** (sin `placeOrder`, `zeroAddress`, Solidity en el deck de marketing)
- **Layout**: todos los 8 slides testeados a 1600×900 en Chrome headless, sin overflow
- **Números**: reproducibles vía `verificar-numeros.py` contra subgraph de producción

## Decisiones de Diseño y Producto para Finalizar

- [ ] **Dominio:** ¿Está disponible `p2p.law`? (Chequea WHOIS; los TLDs `.law` cuestan $50–200/año)
- [ ] **Productos del catálogo:** Reemplaza placeholders de demo con ítems reales de tu vertical
- [ ] **Equipo/contacto:** Llena slide 15 con nombres de fundadores o info de contacto

## Cómo Presentar

1. **Primero:** Abre `deck.html` en pantalla completa
2. **Durante Q&A:** Salta a `deck-tecnico.html` para deep-dives de arquitectura
3. **A pedido:** Lanza `index.html` para mostrar la demo interactiva
4. **Si preguntan números:** Referencia el slide de números del pitch; los números están en `verificar-numeros.py`

**Tip para jurados:** Arranca con el slide de números (39,6 % de disputas son fallas de plataforma, no error de usuario). Es el gancho.

## Stack Tecnológico

- **Frontend:** HTML5 vanilla, CSS3 (sin build step)
- **Lógica de demo:** JavaScript client-side, `jsdom` para testing
- **Verificación de datos:** Python 3 + GraphQL contra subgraph de Goldsky
- **Referencia del SDK:** `@p2pdotme/sdk@1.2.22`

## Licencia

Construido para el hackathon [Builder Break × P2P.me](https://www.p2p.me). Abierto para uso educativo.

---

## Próximos Pasos

1. **Verifica disponibilidad del dominio** antes de imprimirlo o presentarlo
2. **Obtén USDC en Base** temprano; no esperes hasta la última hora
3. **Actualiza placeholders** (productos, contacto del equipo)
4. **Testa en el hardware real del jurado** — abre los decks en sus laptops, no en la tuya

Buena suerte. 🟢
