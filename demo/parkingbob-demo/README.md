# parkingBob — Stageshow Demo

Animated faux product demo for parkingBob built with the [Stageshow](https://github.com/benjitaylor/skills) kit.

## Five beats

| Beat | What happens |
|---|---|
| 1 | User types *"find car parking in Koramangala under ₹50"* |
| 2 | parkingBob thinking… (animated 3-dot bounce) |
| 3 | AI reply streams in word-by-word |
| 4 | Two spot cards slide in below the reply |
| 5 | User clicks **Book** on the first card → busy → Booked ✓ |

## Design tokens

| Token | Value |
|---|---|
| Background | `#0F172A` slate-900 |
| Surface | `#1e293b` slate-800 |
| Accent | `#2563EB` blue-600 |
| Success | `#22c55e` green-500 |

## Usage

This demo is a React component. To run it inside the Stageshow playground:

```bash
# From the .bob/skills/stageshow/ directory:
npm install
npm run dev
```

Then copy `demo/parkingbob-demo/` into `.bob/skills/stageshow/examples/parkingbob/` and open `http://localhost:5173/?capture=parkingbob`.

To use standalone in the main app, install the kit deps:

```bash
npm install react react-dom lucide-react
```

And import:

```tsx
import ParkingBobDemo from "./demo/parkingbob-demo";
```

## Files

- [`index.tsx`](index.tsx) — Stage component, 5-beat script, state machine
- [`demo.css`](demo.css) — Dark theme tokens, spot card styles, booking button layers
- [`kit/`](kit/) — Stageshow kit (copied from `.bob/skills/stageshow/kit/`)
