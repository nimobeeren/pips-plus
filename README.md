# hard-pips

A domino puzzle game inspired by the New York Times' [Pips](https://www.nytimes.com/games/pips).

## How to Play

Place all dominoes onto the board so that every colored region's constraint is satisfied.

Each domino has two halves showing 0–6 pips (dots) and covers two adjacent cells on the board. The board is divided into colored regions, each with a rule displayed in its corner:

- **=** — All pip values in the region must be the same
- **≠** — All pip values must be different
- **Sum (number)** — Pip values must add up to that number
- **> n** — Every pip value must be greater than n
- **< n** — Every pip value must be less than n
- **Blank** — No constraint

Click a domino to rotate it. Drag it onto the board to place it. The puzzle is solved when all dominoes are placed and every constraint is met.

## Getting Started

### Prerequisites

- Node.js >= 23
- pnpm

### Installation

```sh
pnpm install
```

### Development

```sh
pnpm dev
```

### Build

```sh
pnpm build
```
