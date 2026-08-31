# Tests

Verifican los dos entregables sin navegador manual. Necesitan `jsdom` y `ws`:

```bash
npm i jsdom ws
node tests/drive.mjs        # recorre la demo entera: 41 checks
node tests/deck-test.mjs    # el deck: 31 checks
node tests/overflow.mjs ../deck.html   # ¿algún slide desborda su marco? (necesita Chrome)
```

- `drive.mjs` — maneja `index.html` de punta a punta en jsdom: compra, disputa,
  sorteo de jurados, votación, fallo, reembolso, reset y camino feliz.
- `deck-test.mjs` — estructura del deck, navegación por teclado, cifras presentes,
  y **ausencia de jerga técnica** (el deck de marketing no debe nombrar `placeOrder`,
  `zeroAddress`, Solidity…).
- `overflow.mjs` — mide cada slide en Chrome headless a 1600×900 y reporta
  cuáles desbordan. `[]` significa que ninguno.
- `shot.mjs` / `shotdemo.mjs` / `hero.mjs` — capturas para revisar a ojo.
- `lemon.mjs` — vuelve a extraer la paleta y tipografía de lemon.me,
  que es de donde salió el sistema visual.
