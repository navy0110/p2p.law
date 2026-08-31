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

## 🛠️ Stack Tecnológico
 
- **Frontend** — HTML5 vanilla, CSS3 (sin frameworks, sin build step)
- **Lógica de Demo** — JavaScript client-side, `jsdom` para testing
- **Verificación de Datos** — Python 3 + GraphQL (cliente de subgraph Goldsky)
- **Referencia del SDK** — `@p2pdotme/sdk@1.2.22`
- **Diseño** — Familia de fuentes Geist (Google Fonts), variables CSS personalizadas
**Cero dependencias.** Todo funciona en el navegador.
 
---
 
## 📄 Licencia
 
**Construido para:** [Hackathon Builder Break × P2P.me](https://www.p2p.me)
 
**Licencia:** [MIT License](LICENSE)
 
Eres libre de:
- ✅ Usar este proyecto con fines educativos
- ✅ Forkear, modificar y distribuir (con atribución)
- ✅ Construir sobre esta arquitectura
- ✅ Referenciar el protocolo en tu propio trabajo
Debes:
- 📝 Incluir el aviso de copyright original y la licencia
- 📜 Declarar cambios significativos al código
- ⚖️ Incluir una copia de la Licencia MIT
---
 
## 🙏 Atribución y Referencias
 
- **P2P.me** — Protocolo, SDK (`@p2pdotme/sdk@1.2.22`), y subgraph público (Goldsky)
- **lemon.me** — Sistema de diseño y lenguaje visual (colores, tipografía, espaciado)
- **Builder Break** — Organización y soporte del hackathon
- **Fuente Geist** — Tipografía de UI (Google Fonts)
Este proyecto **no está afiliado a ni endosado por P2P.me o lemon.me**. Es una implementación educativa independiente construida durante el hackathon.
 
---
 
## 🚦 Roadmap (Post-Hackathon)
 
- [ ] Desplegar `Garantia.sol` a testnet de Base
- [ ] Wiring de demo a llamadas reales del SDK de P2P.me
- [ ] Agregar conexión de wallet (MetaMask)
- [ ] Implementar sorteo real de jurados (Chainlink VRF)
- [ ] Conectar a subgraph de producción
- [ ] Construir dashboard de vendedor
- [ ] Agregar flujo de apelación
- [ ] Lanzar piloto en mainnet de Base
---
 
## 🙌 Contribuyendo
 
¿Encontraste un bug en la demo? ¿Quieres mejorar el deck de pitch?
 
1. Forkea este repo
2. Crea una rama: `git checkout -b fix/tu-nombre-de-fix`
3. Commit: `git commit -am 'Fix: describe tu cambio'`
4. Push: `git push origin fix/tu-nombre-de-fix`
5. Abre un pull request
**Antes de enviar:**
- Testa los 3 flujos en la demo
- Verifica que los slides del deck rendericen correctamente
- Ejecuta `python3 verificar-numeros.py` (los números deben coincidir)
- Chequea que no haya nuevos errores JavaScript (consola F12)
---
 
P2P.me ha construido la infraestructura para comercio sin confianza. **p2p.law construye el tribunal que lo hace justo.**
 
El protocolo es simple:
1. **Bloquea stake** → jurados tienen capital en riesgo
2. **Vota sobre evidencia** → ambos lados presentan prueba
3. **Liquida programáticamente** → veredicto dispara movimiento real de dinero
Sin llaves de admin. Sin intuición. Sin retrasos.
 
---
 
## 📜 Información del Documento
 
- **Creado:** Agosto de 2026
- **Última Actualización:** 31 de agosto de 2026
- **Versión:** 1.0 (Hackathon Release)
- **Idioma:** Español
- **Estado:** Listo para producción en envío de hackathon
---
 
## 🔗 Links Rápidos
 
- **Subgraph en Vivo:** https://api.goldsky.com/api/public/project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/prod/gn
- **Docs del SDK de P2P.me:** https://docs.p2p.me
- **Builder Break:** https://www.p2p.me
- **Licencia MIT:** https://opensource.org/licenses/MIT



