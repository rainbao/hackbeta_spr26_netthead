# Comic Spire — Design Review & Improvement Roadmap

*Reviewed: 2026-03-21 | Engine: React/Vite single-file SPA*

---

## 1. What's Working Well

- **Panel-placement combat** — The 2x2 comic page grid is a genuinely novel idea. Cards feeling like comic panels is thematically coherent and spatially interesting.
- **Keyword synergy web** — 12 keywords + 22 amps create a dense but legible interaction graph. The combo/channel/momentum triad in particular has satisfying escalation loops.
- **Stat-driven enemies** — Pulling enemies from a hero CSV and generating decks/attacks from their archetypes gives fights variety without hand-crafting every encounter.
- **Absorb system** — Taking cards directly from defeated enemies' decks is thematically great and rewards attention to enemy archetypes.

---

## 2. Core Design Gaps

### 2.1 The Evilness / Morality System (Priority: High)
`alignment` is initialized to `'neutral'` and never touched again. This is the biggest unused hook in the game. See §3 for the full proposal.

### 2.2 Event Pool is Too Thin
Only 3 events exist. Players see repeats constantly. A run needs ~12–20 events to feel fresh.

### 2.3 Rest Site is Nearly Invisible
Healing 30% HP with a popup is fine, but the rest site has no narrative weight. It's a vending machine.

### 2.4 Gold Feels Pointless Late
By floor 10+ the shop rarely has anything better than what you've already absorbed. Gold accumulates with nothing to spend it on.

### 2.5 No Run Meta-Progression
Every run starts identically (same 14-card starter deck, same stats). There is no unlock system, no persistent reward for beating a boss, no prestige incentive beyond `potLv`.

### 2.6 Enemy Intent Is Too Opaque
Even at max speed (4 panels visible), the enemy plan shows icon blobs. Without a legend, new players can't read intent.

### 2.7 Desperate Mode Is a Death Spiral
When player HP < 30%, both player AND enemy deal 2x damage. This usually means the player dies faster rather than having a comeback arc.

---

## 3. Morality / Evilness System — Full Proposal

### 3.1 Concept
Characters in the CSV have `isVillain` flags. The player absorbs cards from both heroes and villains. Track whether the player's deck leans heroic or villainous based on which cards they absorb, which events they choose, and which relics they carry.

### 3.2 Evilness Value
```
evilness: number  // 0–100, starts at 50 (neutral)
```
Displayed as a sliding bar on the map screen HUD, from `⚔️ HERO` (0) to `💀 VILLAIN` (100).

**Thresholds:**
| Range | Alignment | Label |
|-------|-----------|-------|
| 0–20  | Pure Hero | `RIGHTEOUS` |
| 21–40 | Hero | `VALIANT` |
| 41–59 | Neutral | `ROGUE` |
| 60–79 | Villain | `RUTHLESS` |
| 80–100| Pure Villain | `CORRUPT` |

### 3.3 What Shifts Evilness

**Increases evilness (+):**
- Absorbing a card from a villain's deck: `+3`
- Absorbing the villain's signature card: `+6`
- Choosing the cruel option in an event (e.g., "Steal the lab's data")
- Buying a "dark" amp in the shop (flagged by `alignBias: 'evil'`)
- Defeating an elite hero (not villain): `+4`
- Choosing corrode/blood/rage cards: `+1` each absorption

**Decreases evilness (−):**
- Absorbing a card from a hero's deck: `−3`
- Absorbing a hero's signature: `−6`
- Choosing the merciful option in events
- Buying a "light" amp (`alignBias: 'good'`)
- Resting instead of fighting when given the choice: `−2`
- Choosing heal/defend/draw cards: `−1` each absorption

### 3.4 Gameplay Effects by Alignment

#### HERO side (evilness < 40)
- `RIGHTEOUS` passive: +3 block per turn for free
- Hero enemies take 10% less damage from you (they respect you — shorter fights feel earned, longer ones are tense)
- Shop heroes offer cards at a 15% discount
- Rest sites heal +5% more
- Boss encounter: **"Villain Overlord"** — extra tough but drops a legendary amp

#### VILLAIN side (evilness > 60)
- `CORRUPT` passive: All poison effects +1 stack
- Villain enemies surrender 1 extra card in absorb phase
- Shop villains offer exclusive dark amps not otherwise available
- Events have additional villain-only choices with higher risk/reward
- Boss encounter: **"Hero Council"** — fights 2 enemies in sequence; massive gold payout

#### NEUTRAL (40–60)
- Wildcard: Events can go either direction
- Special neutral-only amp: **"Chaos Engine"** — 20% chance any card effect doubles
- No passive bonuses, but no penalties either
- Unlock the **"Grey Zone"** event type (exclusive to neutral runs)

### 3.5 Visual Feedback for Alignment
- Map HUD: A small alignment bar under the HP bar with emoji icon + label
- Card tooltip: Cards absorbed from villains show a faint `💀` watermark; hero cards show `⚔️`
- Combat backdrop: Slowly shifts hue based on alignment (cool/blue for hero, red/dark for villain, grey for neutral)
- End-of-run screen: Shows final alignment + narrative blurb ("You walked the path of the Corrupt...")

### 3.6 Implementation Steps (Smallest First)
1. Add `evilness: 50` to player state
2. Add `alignBias: 'good'|'evil'|'neutral'` to enemies (derived from `isVillain`)
3. In the absorb reward screen, call `shiftEvil(+3 or -3)` based on absorbed card's enemy type
4. Add the alignment bar to the map HUD
5. Add passive bonuses at combat start (`RIGHTEOUS` block, `CORRUPT` poison)
6. Add villain-exclusive / hero-exclusive amps to `ALL_RELICS`
7. Change boss encounter based on alignment at floor 14
8. Wire events to shift evilness on choice

---

## 4. Card & Combat Design Improvements

### 4.1 Desperate Mode Rework
**Current**: Player AND enemy deal 2x at <30% HP — death spiral.
**Proposed**: Player deals 1.5x, enemy deals 1.0x (no bonus). Add a relic that ups player bonus to 2x for players who want the high-risk fantasy.

### 4.2 Frenzy Needs A Cap
Frenzy hits twice at half value. With combo stacks, it can one-shot any enemy. Cap combo bonus applied to frenzy at `+6 total`.

### 4.3 Add a Taunt / Distraction Card Type
Currently the player has no way to force the enemy to skip a panel. A `taunt` keyword that delays enemy's next action would add meaningful defensive decision-making.

### 4.4 Card Upgrade System
Add a "Forge" node type (appears once per run, floors 5–9). Lets the player upgrade one card:
- Attack/magic: +3 damage
- Defend: +3 block
- Special keywords: Upgraded version (e.g., CHANNEL → OVERCHANNEL, COMBO → gains CHARGE)

### 4.5 Panel Position Bonuses
Since the 2x2 grid is a core visual, reward card placement:
- Top-left cell: +1 energy refunded if card costs ≥ 2
- Bottom-right cell: Card gets +20% damage if placed last
- Center-spanning card (h2 on row 0, cols 0–1): Gets "HEADLINE" bonus — guaranteed crit

This makes the grid feel spatial rather than just visual decoration.

### 4.6 Cross-Keyword Combos
Explicitly reward stacking two keywords on the same turn:
| Combo | Bonus |
|-------|-------|
| CHANNEL + CORRODE | Corrode stacks doubled this turn |
| COMBO + MOMENTUM | Free card refund if 5+ combo built |
| BLOOD + CHARGE | Charge fires at 2x (not 1.5x) |
| FORTIFY + SHIELD BASH | Bash damage = full max block (not current) |

---

## 5. Map & Progression Improvements

### 5.1 Alignment-Gated Paths
Add path forks that require minimum evilness or maximum evilness to enter:
- A dark path (floor 6–9 variant) only accessible if `evilness > 65` — harder enemies, villain-exclusive rewards
- A holy path only accessible if `evilness < 35` — easier enemies, hero-tier amps

### 5.2 Expand Event Pool
Suggested new events (with alignment consequences):

| Event | Options | Evilness Effect |
|-------|---------|-----------------|
| Wounded Hero | Heal them (−5) / Absorb their card (neutral) / Leave them (+2) | varies |
| Dark Market | Buy stolen card (discount, +6 evil) / Report it (−3 evil, +15 gold) | varies |
| Fan Encounter | Sign autograph (−2 evil) / Ignore (neutral) / Threaten (+4 evil) | varies |
| Villain's Cache | Take the loot (+8 evil) / Destroy it (−4 evil) / Leave (neutral) | varies |
| Ancient Codex | Learn dark technique (+5 evil, gain CORRODE card) / Burn it (−3 evil) | varies |
| Rival Appears | Fight them (battle with unique reward) / Negotiate (gold) | neutral |
| Lab Accident | Gain mutation amp (+3 evil) / Help victims (−3 evil, +HP) | varies |

### 5.3 Boss Variation by Alignment
Instead of one fixed boss, choose from a pool based on evilness:
- `evilness < 35`: **"The Champion"** — pure hero, block-heavy, generous post-fight reward
- `evilness 35–65`: **"The Mercenary"** — balanced, unpredictable deck
- `evilness > 65`: **"The Council of Heroes"** — 2-stage fight, massive villain amp reward

### 5.4 Dynamic Shop Inventory
Shop should have alignment-biased stock:
- Villain shops (appear in villain-leaning runs): sell corrode, blood, rage cards; dark amps
- Hero shops: sell heal, defend, draw cards; light amps
- Neutral shops: random mix as currently

---

## 6. Meta-Progression (Post-Run Unlocks)

Currently `potLv` increments but does nothing. Proposal:

| Condition | Unlock |
|-----------|--------|
| Beat floor 14 for first time | Unlock "Hard Mode" toggle |
| Finish a run as CORRUPT | Unlock 3 villain-exclusive starter cards |
| Finish a run as RIGHTEOUS | Unlock "Paladin" starting amp |
| Reach evilness 100 | Unlock a secret 16th floor |
| Beat 5 runs | Unlock 5 new event cards |
| Use every amp at least once (across runs) | Unlock "Chameleon" amp (copies last amp used) |

Store in `localStorage` as a simple JSON object. Render on the title screen as a codex/achievement panel.

---

## 7. Code Quality Improvements

### 7.1 Extract Balance Constants
Create a `BALANCE` object at top of file:
```js
const BALANCE = {
  PIERCE_CHANCE: 0.30,
  FORTIFY_CARRY: 0.50,
  CHANNEL_PIERCE: 1.0,
  CRIT_MULT: 1.5,
  BLOOD_HP_COST: 5,
  DESPERATE_THRESHOLD: 0.30,
  DESPERATE_MULT: 2.0,
  // etc.
};
```
Makes tuning far easier without hunting through logic.

### 7.2 Split resolveCard into sub-functions
`resolveCard()` at ~68 lines handles 12 keyword branches, damage application, block, and floater spawning. Extract:
- `applyDamageToEnemy(amount, pierce)`
- `applyBlockToPlayer(amount)`
- `spawnFloater(text, color)`
- `resolveKeyword(keyword, card, state)`

### 7.3 Activate the alignment State
Wire `alignment` (or rename to `evilness`) through the existing `bReduce` + `useReducer` pattern — it fits naturally as player-level state alongside `gold`, `deck`, `relics`.

### 7.4 Add a Central Color Theme Object
```js
const THEME = {
  hero: '#66aaff',
  villain: '#cc3344',
  neutral: '#aaaaaa',
  attack: '#ff2244',
  magic: '#8844ff',
  defend: '#2288ff',
  poison: '#44cc44',
  // ...
};
```
Eliminates repeated hex string literals.

### 7.5 Enemy Intent Legend
Add a small floating legend (collapsible, bottom-right) that shows icon → action type mappings. Currently players have no reference.

### 7.6 Remove Dead Code
- Delete `enemyCache` ref (never populated)
- Activate or delete `tooltip` state
- Remove duplicate `hasR()` definitions

---

## 8. Quick Wins (Low Effort, High Impact)

| Change | Effort | Impact |
|--------|--------|--------|
| Wire `evilness` bar to map HUD | Low | High — immediate morality feel |
| +3 corrode passive at `evilness > 80` | Low | High — alignment has teeth |
| Add 5 new events | Medium | High — run variety |
| Enemy intent legend | Low | High — accessibility |
| BALANCE constants object | Low | Medium — tuning speed |
| Panel position bonus (bottom-right +20%) | Medium | High — grid feels meaningful |
| Meta-progression via localStorage | Medium | High — replayability |
| Forge upgrade node | Medium | High — build depth |
| Fix desperate mode (player only benefits) | Low | Medium — reduces death spirals |

---

## 9. Summary

Comic Spire has a strong, unique identity. The panel-placement system, the absorb mechanic, and the keyword synergy web are all genuinely interesting. The biggest opportunity is **activating the dormant morality system** — it could become the defining feature that separates this game from standard Slay the Spire clones and gives every card choice, every event, and every boss fight a second dimension of meaning. The alignment system proposed above is designed to touch every existing system (combat, map, shop, events, boss) with minimal structural changes to the codebase.
