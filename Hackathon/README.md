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
# Replace src/App.jsx content with the contents of comic_spire_v9_1.jsx
# Change the last line from:  export default function ComicSpire(){
# to make App.jsx import and re-export it, or rename the function to App
npm run dev
```

### Option C — CodeSandbox / StackBlitz
Create a new React sandbox and paste the file contents into `App.jsx`.

---

## Project Structure

```
Hackathon/
├── comic_spire_v9_1.jsx     # Entire game — single React component
├── HackBeta - Superhero CSV.csv  # Source data (embedded inside JSX as CSV_RAW)
├── HackBeta Challenge - Game.pdf # Challenge brief
├── README.md                # This file
└── DESIGN.md                # Full game design reference
```

> The CSV data is embedded directly in the JSX file as the `CSV_RAW` constant. The `.csv` file is the source of truth for hero stats.

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
| 9–57 | `CSV_RAW` — embedded hero/villain data |
| 59–63 | Utility functions (`parseCSV`, `clamp`, `shuffle`, `pick`, etc.) |
| 68–81 | `KW_INFO` — keyword definitions and tooltip text |
| 84–90 | `SHAPES` — panel shape definitions |
| 93–147 | `getSignature()` — generates a signature card from hero stats |
| 149–154 | `makeStarterDeck()` — Punch × 4, Guard × 4, Spark × 1, Adapt × 1 |
| 156–176 | `makeEnemy()`, `rollIntent()`, `pickEnemy()` — enemy factory |
| 178–196 | `makeMap()` — 15-floor procedural map |
| 198–225 | `EVENTS`, `ALL_RELICS` — event pool and relic definitions |
| 235–246 | Grid helpers: `canPlace`, `doPlace`, `getValid` |
| 249–317 | `resolveCard()` — card effect resolution logic |
| 320–437 | `bReduce()` — battle state reducer (INIT, PLACE_CARD, END_TURN) |
| 440–836 | `ComicSpire()` — main component, all screens |

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
