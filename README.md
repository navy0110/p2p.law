# p2p.law — A Dispute Resolution Protocol for P2P Commerce

A decentralized court system for peer-to-peer transactions on P2P.me. Built for [Builder Break × P2P.me hackathon](https://www.p2p.me).

## The Problem

P2P.me handles ~700k orders annually with a **0.47% dispute rate** (3,306 cases). Today, disputes are resolved by admin keys and gut feeling. There's no:

- **Clear ruleset** for what constitutes buyer error vs. merchant fraud vs. platform failure
- **Incentive structure** — why would a juror spend effort to vote correctly?
- **Transparent record** — who decided what, with which evidence, and why?

Meanwhile, the on-chain infrastructure already exists: `raiseDispute()`, `disputeStatus`, `disputeFaultType`, settlement fields. The court system is missing.

## The Solution

**p2p.law** is a jury protocol that:

1. **Assigns disputes by sortition** to jurors who lock stake (`JURY` tokens)
2. **Forces evidence submission** — both buyer and merchant present proof on-chain
3. **Votes with skin in the game** — juror stake slashed if they vote with the minority
4. **Settles via P2P.me's `PAY` rail** — the verdict is a programmatic fiat disbursement, no manual transfers

Three layers:
- **Buyer**: locks USDC guarantee, submits evidence, awaits verdict
- **Juror**: gets sortitioned, votes on evidence, stake at risk
- **Settlement**: verdict triggers `PAY` order, merchant scans QR, fiat lands in local account

## Live Decks & Demo

| File | What | Open with |
|---|---|---|
| **`index.html`** | Interactive 3-flow demo (playable, no backend) | `open index.html` or double-click |
| **`deck.html`** | 8-slide marketing pitch (press this one) | `open deck.html` |
| **`deck-tecnico.html`** | 15-slide technical deep-dive (backup for jury questions) | `open deck-tecnico.html` |

**All three are self-contained** — no server needed, no network requests. Open them in any browser.

### Demo: Play All Three Flows

- **Buyer flow** — select product, lock USDC, upload evidence, raise dispute
- **Juror flow** — sortitioned to a case, review evidence, vote with stake on line
- **Settlement flow** — verdict releases escrow, triggers `PAY`, scan QR, pesos arrive

Right panel shows step-by-step SDK calls (real `@p2pdotme/sdk` calls in 🔵 blue, mocked contracts in 🟠 orange, confirmations in 🟢 green).

### Keyboard Navigation

- **Arrow keys** ← → : navigate slides
- **Spacebar**: next slide
- **`P`**: export to PDF (Chrome: Print → Save as PDF, margins: None, check "Background graphics")

## Key Numbers (Measured 2026-08-29)

All verified against [P2P.me public subgraph](https://api.goldsky.com/api/public/project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/prod/gn) and `@p2pdotme/sdk@1.2.22`.

| Metric | Value | Insight |
|---|---|---|
| Historical disputes on-chain | **3,306** | 0.47% of 701k orders |
| Dispute rate by fault type | **39.6% BANK**, 38.2% merchant, 22% buyer | Platform failures are #1 cause |
| Addresses that settled disputes | **36** total; 5 address 82.5% of volume | Centralized admin keys today |
| Median resolution time | **30 min** (p90: 10.5h, worst: 35.8 days) | Speed varies wildly |
| `PAY` type disputes | **38.7%** of total | Largest dispute category |
| Appeals in history | **55** (1.7% of disputes) | Low appeal rate = trust issue? |

**The argument these numbers make:** P2P.me has the **ledger** of a dispute system (status fields, timestamps, fault tracking). What's missing is the **court** — a rule set, jury incentives, and transparent settlement logic.

## Architecture Insight: What We Fixed

The original brief assumed `placeOrder` "pauses funds in escrow for 7 days." Reading the SDK and subgraph revealed the actual design:

> P2P.me orders are **fiat ↔ USDC swaps that settle in ~18 seconds**. Their escrow lives seconds, not days.

This changes everything:

- **Our contract** (`Garantia.sol`) holds the USDC for the return window (7 days)
- **P2P.me enters at settlement** — the verdict fires a `PAY` order (programmatic local-currency disbursement, no bank integration needed)
- **`raiseDispute()` is real but covers a different layer** — "merchant says they paid but fiat didn't arrive" (rail failure), not "product arrived broken" (buyer dispute). Two distinct cases. The pitch mentions this to show we read the protocol, not the README.

**Non-obvious detail:** `PAY` orders don't encode the payment destination at placement. They go out with `recipientAddr: zeroAddress`, and the QR is scanned *after* the merchant accepts, via `setSellOrderUpi`.

## Design System

Sourced from **lemon.me** (extracted from live site, not memory):

| Token | Value | Usage |
|---|---|---|
| Lima accent | `#CFFF2E` | highlights, badges, slide backgrounds |
| Forest green | `#003D1B` | inverted slides, status chips |
| Ink | `#121212` | text, primary buttons |
| Warm paper | `#F5F4F0` | cards, alternate sections |
| Font | **Geist** 800/900 (display), 400/500 (text) | Google Fonts |
| Border radius | 17px (cards) · 24px (blocks) · 100px (badges) | — |

**Hard rule:** Lima is never text on a light background. Use only as fill. It only appears as text over ink or forest green.

## Getting Started

### View the Demo
```bash
open index.html
```

### Verify the Numbers
```bash
python3 verificar-numeros.py
```

Hits the live P2P.me subgraph and reproduces every stat in the pitch.

### Prerequisites for Real `PAY` Orders
- USDC in a wallet on **Base network**
- Access to `@p2pdotme/sdk@1.2.22` or higher
- P2P.me merchant account

## File Structure

```
.
├── index.html              # Interactive demo + explainer
├── deck.html               # 8-slide marketing pitch
├── deck-tecnico.html       # 15-slide technical backup
├── verificar-numeros.py    # Reproduce pitch numbers from subgraph
├── README.md               # This file
└── .gitignore
```

## Testing

- **Demo**: 41 checks (jsdom) covering all 3 flows end-to-end, zero JS errors
- **Deck**: 31 checks — navigation, slide count, presence of all pitch numbers, **verified absence of jargon** (no `placeOrder`, `zeroAddress`, Solidity in the marketing deck)
- **Layout**: all 8 slides tested at 1600×900 in headless Chrome, no overflow
- **Numbers**: reproducible via `verificar-numeros.py` against production subgraph

## Design & Product Decisions to Finalize

- [ ] **Domain:** Is `p2p.law` available? (Check WHOIS; `.law` TLDs run $50–200/year)
- [ ] **Catalog products:** Replace demo placeholders with real items from your vertical
- [ ] **Team/contact:** Fill slide 15 with founder names or contact info

## How to Present

1. **First:** Open `deck.html` in full screen
2. **During Q&A:** Jump to `deck-tecnico.html` for architecture deep-dives
3. **On request:** Launch `index.html` to show the interactive demo
4. **If they ask numbers:** Reference the pitch deck; numbers are in `verificar-numeros.py`

**Tip for jurors:** Lead with the numbers slide (39.6% of disputes are platform failures, not user error). It's the hook.

## Tech Stack

- **Frontend:** Vanilla HTML5, CSS3 (no build step)
- **Demo logic:** Client-side JavaScript, `jsdom` for testing
- **Data verification:** Python 3 + GraphQL against Goldsky subgraph
- **SDK reference:** `@p2pdotme/sdk@1.2.22`

## License

Built for [Builder Break × P2P.me hackathon](https://www.p2p.me). Open for educational use.

---

## Next Steps

1. **Verify domain availability** before you print or present it
2. **Get USDC on Base** early; don't wait until the last hour
3. **Update placeholders** (products, team contact)
4. **Test on the actual jury's hardware** — open the decks on their laptops, not yours

Good luck. 🟢
