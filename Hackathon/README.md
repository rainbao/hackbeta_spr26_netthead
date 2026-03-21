# Comic Spire — HackBeta Challenge

A **Slay the Spire-inspired card game** built with React. You play as **Potential Man**, a hero who can copy the signature abilities of every enemy you defeat. Enemies are loaded from a CSV of superheroes and villains.

---

## Quick Start

This is a single React component. You have two options to run it:

### Option A — Claude Artifact (fastest)
1. Open [claude.ai](https://claude.ai) and start a new conversation.
2. Paste the full contents of `comic_spire_v9_1.jsx` and ask Claude to render it as an artifact.

### Option B — Vite (recommended for development)

```bash
npm create vite@latest comic-spire -- --template react
cd comic-spire
npm install

# Copy the game files
cp ../comic_spire_v9_1.jsx src/App.jsx
cp -r ../public . 

npm run dev
```

**What to do:**
1. Replace `src/App.jsx` with contents of `comic_spire_v9_1.jsx` (or copy the file directly)
2. Copy the `public/` folder from this directory — it contains `heroes.csv` that the game loads at runtime
3. Run `npm run dev` and open browser to `http://localhost:5173`

The app will automatically fetch `heroes.csv` from the public folder on startup.

### Option C — CodeSandbox / StackBlitz
Create a new React sandbox and paste the file contents into `App.jsx`.

---

## Project Structure

```
Hackathon/
├── comic_spire_v9_1.jsx          # Entire game — single React component
├── public/
│   └── heroes.csv                # Character data (loaded at runtime)
├── HackBeta - Superhero CSV.csv  # Source data file (reference)
├── HackBeta Challenge - Game.pdf # Challenge brief
├── README.md                      # This file
└── DESIGN.md                      # Full game design reference
```

> The CSV data is now **loaded dynamically at runtime** from `public/heroes.csv`. The component first tries to fetch the file, and falls back to an embedded list if fetch fails (for environments like Claude Artifact or CodeSandbox).

---

## Game Overview

| Aspect | Detail |
|--------|--------|
| Player | Potential Man — starts with 55 HP, 3 energy, 10-card starter deck |
| Map | 15 floors: battles, elites, boss, shops, events, rest sites |
| Core mechanic | Place cards on a 2×3 comic page grid; they resolve in reading order on End Turn |
| Progression | Defeat enemies → copy their signature card → build synergistic deck |
| Win condition | Defeat the final boss on floor 14 |

---

## File Anatomy (`comic_spire_v9_1.jsx`)

| Lines | Section |
|-------|---------|
| 1–8 | Imports and version comment |
| 9–70 | `FALLBACK_CSV` — small embedded backup CSV (for environments without file access) |
| 72–110 | CSV loading `useEffect` — fetches `public/heroes.csv` at runtime |
| 111–115 | Utility functions (`parseCSV`, `clamp`, `shuffle`, `pick`, etc.) |
| 120–133 | `KW_INFO` — keyword definitions and tooltip text |
| 136–142 | `SHAPES` — panel shape definitions |
| 145–199 | `getSignature()` — generates a signature card from hero stats |
| 201–206 | `makeStarterDeck()` — Punch × 4, Guard × 4, Spark × 1, Adapt × 1 |
| 208–228 | `makeEnemy()`, `rollIntent()`, `pickEnemy()` — enemy factory |
| 230–248 | `makeMap()` — 15-floor procedural map |
| 250–277 | `EVENTS`, `ALL_RELICS` — event pool and relic definitions |
| 287–298 | Grid helpers: `canPlace`, `doPlace`, `getValid` |
| 301–369 | `resolveCard()` — card effect resolution logic |
| 372–489 | `bReduce()` — battle state reducer (INIT, PLACE_CARD, END_TURN) |
| 492–... | `ComicSpire()` — main component, all screens (uses heroes from CSV state) |

---

## Screens

```
title → map → [battle / shop / event] → reward (card pick) → reward (relic pick) → map
                                       ↘ gameOver
```

---

## Development Notes

- All styling is inline CSS — no external stylesheets or Tailwind
- Fonts: `Bangers` (display) and `Courier Prime` (body) loaded from Google Fonts
- Colors: `TC` map for card types, `NC`/`NI` maps for map node colors/icons
- The battle reducer is a pure function — all side effects (HP updates, healing) are passed in via `action` callbacks
- `alignement` state exists but currently only affects color theming (not gameplay)
