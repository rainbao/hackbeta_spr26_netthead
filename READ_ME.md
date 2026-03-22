# Potential Man Technical Documentation

## 1. Project Overview
Potential Man is a single-player, comic-themed roguelike deckbuilder built in React. The core gameplay loop combines map navigation, tactical panel placement in a 2x2 combat grid, enemy deck simulation, card/amp rewards, and alignment-driven progression. The game emphasizes expressive keyword synergies (for example Combo, Channel, Blood, Corrode, and Momentum) and run-to-run variance through procedural map paths, randomized encounters, and dynamic enemy generation from CSV data.

## 2. Tech Stack and Runtime
- Frontend framework: React (functional components + hooks)
- Build tool: Vite
- Language: JavaScript (JSX)
- Data format: CSV for hero/enemy source data
- Audio: custom in-app audio system (`createAudioSystem`)
- Primary execution target: browser (desktop-first, responsive behavior for smaller screens)

## 3. Workspace Structure
- `comic-spire/src/App.jsx`: core game logic, UI flow, state orchestration, and screen rendering
- `comic-spire/src/audio.js`: game audio management (BGM, SFX, interaction cues)
- `comic-spire/src/main.jsx`: React app bootstrapping
- `comic-spire/src/App.css`, `comic-spire/src/index.css`: global and component-level styling support
- `comic-spire/public/heroes.csv`: primary runtime CSV source for hero/enemy data
- `heroes.csv` (workspace root): additional CSV source available in repository

## 4. Gameplay Systems (Design + Implementation)

### 4.1 Core Loop
1. Start run from title screen.
2. Traverse branching map nodes (battle, elite, boss, shop, event, rest).
3. Enter encounters and resolve tactical card turns in battle.
4. Collect rewards (cards/amps/gold/progression stats).
5. Continue floor-by-floor until victory or defeat.

### 4.2 Combat Model
- Combat uses a page metaphor: cards are placed into a 2x2 panel grid.
- On turn end, queued pages resolve in sequence using reducer-driven state transitions.
- Card outcomes depend on type, cost, keyword, shape/slot rules, and current buffs/debuffs.
- Enemy intent is generated and shown before resolution to support tactical planning.

### 4.3 Resource and Progression Systems
- Energy-per-turn gating controls player tempo and hand usage.
- Gold economy drives shop purchases for cards and amps.
- Amps provide passive modifiers and build-defining synergies.
- Evilness/alignment modifies run flavor and influences encounter/vendor behavior.
- Ascension/New Game Plus increases challenge and extends replayability.

### 4.4 Node and Encounter Types
- `battle`: standard enemy fight
- `elite`: harder encounter with stronger reward potential
- `boss`: major gate encounter with high stakes
- `shop`: spend gold on cards/amps
- `event`: choice-based outcomes with risk/reward
- `rest`: recovery/utility pause in run pacing

## 5. Data Pipeline and Content Generation

### 5.1 CSV Ingestion
At startup, the game attempts to load hero data from `/heroes.csv` and fallback paths. If file fetch fails, it falls back to embedded CSV content. Parsed rows feed:
- enemy selection pools
- signature card generation
- hero/villain alignment filters

### 5.2 Enemy Generation
Enemies are generated using hero data plus floor context and encounter type (normal/elite/boss). Generation considers:
- run depth scaling
- hero/villain alignment context
- randomization for deck/intent variance

### 5.3 Reward Generation
Rewards are assembled from multiple systems:
- card reward pools from defeated enemies
- amp candidates filtered by current inventory/synergy
- floor-scaled gold payouts

## 6. Application Architecture

### 6.1 State Management
`App.jsx` combines several state patterns:
- `useState`: UI screens, economy, map, player profile, transient overlays
- `useReducer`: battle state machine and deterministic combat transitions
- `useMemo`: computed views (e.g., hovered path sets, audio system)
- `useRef`: long-lived mutable objects (enemy cache, previous-frame/screen state)

### 6.2 Screen-Driven UI
The app uses a screen enum pattern (`title`, `map`, `battle`, `shop`, etc.) and conditionally renders each view branch directly in the main component. This approach keeps state local and avoids route dependency for game flow.

### 6.3 Side Effects and Lifecycle
`useEffect` hooks orchestrate:
- CSV loading and fallback behavior
- BGM and SFX transitions by screen/alignment
- keyboard input registration/cleanup
- cinematic scroll and visual transitions
- damage flash, notifications, and transient overlays

## 7. Input, UX, and Accessibility Features
- Keyboard shortcuts for battle actions:
  - `1-9`: select hand card
  - `Arrow keys`: move focused grid cell
  - `Enter`: place selected card or end turn
  - `Escape`: cancel selection
- Pointer interactions for card/amp selection and keyword tooltips
- Visual feedback includes HP bars, intent boxes, floating combat text, shake effects, and alignment notifications
- Debug overlay supports rapid balancing and QA verification

## 8. Audio System Integration
Audio is event-driven and context-aware:
- Menu/combat/shop/rest/victory BGM tracks
- SFX hooks for card placement, draw actions, selection, momentum stages, and turn resolution
- first-interaction unlock flow to satisfy browser autoplay policies

## 9. Performance and Reliability Notes
- Asset preloading is used for comic slate overlays to avoid first-use hitching.
- Enemy caching helps stabilize repeated node interactions.
- Derived state is memoized where helpful to reduce repeated heavy computation.
- Defensive fallback loading for CSV data ensures game boot resilience.

## 10. Extensibility Opportunities
The current architecture is well-positioned for:
- modular extraction of battle logic into separate files/services
- event pack expansion and content pipelines
- additional card keywords, amp classes, and node types
- persistent unlock systems (local storage / backend sync)
- stronger testing around reducer transitions and deterministic combat outcomes

## 11. Build and Run
From `comic-spire/`:

```bash
npm install
npm run dev
```

Then open the local Vite URL in a browser.

## 12. Summary
Potential Man is a game that merges a distinctive comic-panel combat mechanic with roguelike progression systems. Its single-page React architecture centralizes gameplay state while still supporting rich interaction design, procedural variation, and extensible content systems suitable for future iterations.
