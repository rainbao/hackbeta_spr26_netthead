# Comic Spire — Game Design Reference

This document is the authoritative reference for all game mechanics, balance values, and system interactions.

---

## Core Concept

Potential Man has no innate powers — he **copies** signatures from defeated enemies. Every fight adds a card to your available pool. The challenge is building a synergistic combo from whoever you happen to beat.

The combat gimmick: cards are placed on a **comic page panel grid** and resolve in **reading order** (left→right, top→bottom). Larger cards take more grid space. Positioning matters.

---

## Player Stats

| Stat | Starting Value | Max |
|------|---------------|-----|
| HP | 55 | Varies (relics add +8) |
| Energy | 3 | 5 |
| Deck | 10 cards | Unlimited |
| Crit Chance | 10% | +15% with relics |

**Crit**: 1.5× damage. Determined per card resolution, not per turn.

**Desperate** (below 30% HP, or 40% with Death Wish relic): BLOOD cards deal 2× damage.

---

## Map Structure

15 floors, procedurally connected:

```
Floor 0       — START (1 node)
Floors 1–3    — Random (3 nodes each): battle / battle / battle / event / shop
Floors 4      — Merge (1 node): shop / rest / event
Floors 5–7    — Random (3 nodes each)
Floor 8       — Merge (1 node): shop / rest / event
Floors 9–11   — Random (2 nodes each)
Floor 12      — Merge (1 node): rest
Floor 13      — ELITE (1 node)
Floor 14      — BOSS (1 node)
```

**Node types:**

| Icon | Type | Effect |
|------|------|--------|
| ★ | Start | Beginning of run |
| ⚔ | Battle | Fight a normal enemy |
| 💀 | Elite | Harder enemy, better rewards |
| 👑 | Boss | Final challenge |
| 🛒 | Shop | Buy cards/relics with gold |
| ? | Event | Choose from 3 outcomes |
| 🏕 | Rest | Heal 30% max HP |

Shops are blocked on floors 0–1 (too early).

---

## Combat Flow

```
START OF BATTLE
  ├─ Draw 5 cards
  └─ Enemy rolls first intent

PLAYER TURN (repeat until End Turn):
  ├─ Select a card from hand
  ├─ Click a valid panel slot on the 2×3 grid
  └─ Card placed (consumes energy / HP / nothing for frenzy)

END TURN (in order):
  1. Active CHARGE cards fire (from previous turn), reading order
  2. This turn's placed cards resolve, reading order
  3. CHANNEL stacks burst (pierces ALL block + applies Weaken)
  4. REGEN relic heals (+2 HP)
  5. Enemy POISON ticks (then decays by 1, corrode stacks don't decay)
  6. Enemy acts (attack / magic / defend / buff)
  7. New cards drawn (5), energy restored, page cleared
  8. FORTIFY carry-over applied to next turn's starting block

POST-BATTLE:
  ├─ Pick 1 of 3 cards (enemy signature + 2 randoms)
  └─ Pick 1 of 3 relics
```

---

## The Comic Page Grid

```
┌─────┬─────┬─────┐   ← Reading order:
│  1  │  2  │  3  │     resolve left→right
├─────┼─────┼─────┤     then top→bottom
│  4  │  5  │  6  │
└─────┴─────┴─────┘
```

### Card Shapes

| Shape ID | Cells Occupied | Visual |
|----------|---------------|--------|
| `s1` | 1 | Single panel |
| `h2` | 2 horizontal | `██` |
| `v2` | 2 vertical | `█` stacked |
| `h3` | 3 horizontal | `███` (full row) |
| `l2` | 3 (L-shape) | `██` + below-left |

Higher-tier signatures use larger shapes. A tier-3 card with shape `h3` blocks an entire row.

---

## Card Keywords

### COMBO
- **Effect:** Each time you play an attack card this turn, the *next* COMBO card deals +3 bonus damage (stacks).
- **Cross-synergy:** Builds off any attack card, not just combo cards.
- **Relic — Spiked Gauntlets:** +4 per hit instead of +3.
- **Relic — First Blood:** First attack of the turn gets a flat +4.

### CHANNEL
- **Effect:** Adds to a `channelStacks` counter. At end of turn, all stacks burst as piercing magic damage (bypasses ALL block) and applies 2 Weaken to the enemy.
- **Relic — Focus Crystal:** Channel power ×1.3.
- **Relic — Mana Siphon:** Channel burst heals you for 25% of burst damage.

### MOMENTUM
- **Effect:** Each card you play (including placing cards) adds +1 to a `momentum` counter. At 4 stacks, your next card costs 0 energy (one free card per turn).
- **Relic — Lightning Boots:** Free card threshold drops to 3.
- **Relic — Afterimage:** +2 Block every time a card is played.

### FORTIFY
- **Effect:** 50% of your remaining block (after enemy attacks) carries into next turn's starting block.
- **Relic — Titanium Shell:** Carry rate increases to 65%.
- **Relic — Regenerator:** +2 HP per turn (stacks with FORTIFY turns).

### CORRODE
- **Effect:** Applies Corrode poison — a stack that NEVER decays. Regular poison decays by 1/turn; corrode stacks form a permanent floor.
- **Poison formula:** `new_poison = corrode_stacks + max(0, total_poison - corrode_stacks - 1)`
- **Relic — Plague Mask:** All poison applications gain +2.

### BLOOD
- **Effect:** Costs HP instead of energy. Default cost: 5 HP. Can't be played below 1 HP.
- **Below 30% HP (Desperate):** BLOOD cards deal 2× damage.
- **Relic — Blood Ruby:** Cost reduced to 3 HP.
- **Relic — Death Wish:** Desperate threshold raised to 40% HP.

### CHARGE ⏳
- **Effect:** Card does NOT resolve this turn. It "charges" and fires automatically at the start of next END TURN at **+50% value**.
- Charged cards stay visible on the page between turns (glowing animation).
- **Relic — Charge Capacitor:** Charged cards gain +3 extra value.

### ECHO
- **Effect:** Resolves the PREVIOUS card's effect at 50% (or 75% with Echo Chamber relic).
- Previous card can be any type — attack, defend, poison, heal, magic.
- Echo of a charge card: copies the non-charge version.
- **Relic — Echo Chamber:** Echo copies at 75% instead of 50%.

### SHIELD BASH
- **Effect:** Deals damage equal to your current block. Gets 0 damage if played with no block.
- Positioned after FORTIFY or DEFEND cards in reading order for maximum effect.
- **Relic — Reactive Armor:** +5 flat bonus damage on top of block value.

### CATALYZE
- **Effect:** Deals damage equal to the enemy's current poison stacks (instant, doesn't consume poison).
- Pairs extremely well with CORRODE for repeated bursts.
- **Relic — Toxic Catalyst:** Also heals you for 30% of Catalyze damage.

### OVERCHANNEL
- **Effect:** Adds to CHANNEL stacks AND applies permanent CORRODE poison (at ~40% of card value).
- A hybrid of CHANNEL + CORRODE — strong but needs the channel burst to resolve at end of turn.

### FRENZY
- **Effect:** Costs 0 energy but occupies 2 horizontal panel slots (`h2`). Hits 2 times.
- Each hit is calculated independently (benefits from crit, desperate, combo).
- Can't be played if no 2-wide space exists on the grid.

---

## Enemy System

### Stat → Signature Card Mapping

```
Best stat    → Primary keyword
Second stat  → Cross-synergy chance (30%)
```

| Best Stat | Default Keyword | Shape (by tier) |
|-----------|----------------|-----------------|
| Power / Strength | COMBO | s1 → h2 → h3 |
| Magic / Intelligence | CHANNEL | s1 → h2 → v2 |
| Speed | MOMENTUM | s1 → h2 |
| Defense | FORTIFY | s1 → v2 |
| Poison | CORRODE | s1 → h2 |
| Rage (fallback) | BLOOD | s1 → h2 |

### Cross-Synergy Triggers (30% roll)
- Defense + (Power/Strength) → **SHIELD BASH**
- Poison + (Power/Strength) → **CATALYZE**
- Magic + Poison → **OVERCHANNEL**
- Speed (15% roll) → **FRENZY**
- Intelligence (15% roll) → **ECHO**
- Tier ≥ 2 (25% roll) → **CHARGE** version of base keyword

### Enemy Tier
`tier = 1` (threat < 220) | `tier = 2` (threat 220–259) | `tier = 3` (threat ≥ 260)

Where `threat = top3_stats_sum`.

### Enemy Scaling
```
HP = (28 + Defense×0.25 + Strength×0.08) × multiplier
ATK = (3 + Strength×0.07 + Power×0.05) × multiplier + floor×0.4
MAG = (2 + Magic×0.06 + Intelligence×0.04) × multiplier + floor×0.3
DEF = Defense×0.12 × multiplier + 2

multiplier: normal = 1 + floor×0.1 | elite = 1.6 | boss = 2.5
```

### Enemy Intent Weights
```
attack chance = 0.45 + Rage/300
magic:  +0.20
defend: +0.15
buff:   remainder
```

---

## Relic List

| Relic | Synergy | Effect |
|-------|---------|--------|
| Spiked Gauntlets | COMBO | Combo bonus +4 (not +3) |
| First Blood | COMBO | First attack per turn +4 damage |
| Focus Crystal | CHANNEL | Channel stacks ×1.3 |
| Mana Siphon | CHANNEL | Channel burst heals 25% |
| Titanium Shell | FORTIFY | Fortify carry = 65% |
| Regenerator | FORTIFY | +2 HP per turn |
| Lightning Boots | MOMENTUM | Free card at 3 stacks (not 4) |
| Afterimage | MOMENTUM | +2 Block per card played |
| Plague Mask | CORRODE | All poison +2 |
| Blood Ruby | BLOOD | Blood HP cost = 3 |
| Death Wish | BLOOD | Desperate threshold = 40% HP |
| Echo Chamber | ECHO | Echo copies at 75% |
| Reactive Armor | SHIELD BASH | Shield Bash +5 damage |
| Toxic Catalyst | CATALYZE | Catalyze also heals 30% |
| Gold Tooth | any | +10 gold per fight |
| Thick Skin | any | +8 max HP |
| Energy Cell | any | +1 max energy |
| Lucky Coin | any | +5% crit chance |
| Charge Capacitor | CHARGE | Charge cards +3 value |
| War Paint | any | +10% crit chance |

Relic prices in shop: universal relics = 30g, keyword-specific = 45g.

---

## Shop Economy

- Starting gold: **25g**
- Gold per battle: **15–35g + floor×3**
- Boss bonus: **+50g** | Elite bonus: **+20g**
- Gold Tooth relic: **+10g per fight**
- Card prices: `18 + tier×12 + value` gold
- Event "Abandoned Lab" grants: **+25g** option

---

## Events

| Event | Options |
|-------|---------|
| Mysterious Stranger | Upgrade a copied card \| Remove a basic card \| +10 HP |
| Abandoned Lab | +1 max energy \| +25 gold \| +5 HP |
| The Mirror | Duplicate best card (by value) \| Upgrade weakest card (+40%) \| +12 HP |

---

## Starter Deck (10 cards)

| Card | Type | Effect | Cost |
|------|------|--------|------|
| Punch ×4 | Attack | Deal 4 | 1 |
| Guard ×4 | Defend | Gain 4 Block | 1 |
| Spark ×1 | Magic | Deal 3 magic | 1 |
| Adapt ×1 | Heal | Heal 4 | 1 |

All starter cards are `s1` shape (single panel). Basic cards can be removed at events but cannot be reward cards.

---

## Known Design Tensions

1. **SHIELD BASH** requires block set up *earlier in reading order* on the same turn. A tier-3 h3 SHIELD BASH at position 4–6 can hit very hard with a FORTIFY at position 1 first — but FORTIFY fires after combat, so you need GUARD cards or earlier-placed FORTIFY to generate block.

2. **ECHO** of a CHARGE card copies the uncharged value at 50%, which is weaker than waiting for the charge. Echo is better used after CHANNEL or CATALYZE cards.

3. **FRENZY** at 0 energy is powerful early but blocks 2 grid cells, becoming a liability in later turns when you need flexible placement for CHARGE carry-overs.

4. **CORRODE + CATALYZE** is the strongest poison combo — build corrode stacks over multiple turns and then CATALYZE for massive burst. The Toxic Catalyst relic makes this also a healing strategy.

---

## Future Work / Ideas

- [ ] Alignment system (hero vs villain) currently only affects UI color — could gate certain cards or relics
- [ ] `copiedAbilities` array is tracked but not displayed during combat — could show as a passive abilities list
- [ ] Corrupted/Evilness CSV stats are parsed but unused in gameplay
- [ ] Personality trait (Sarcastic, Brave, etc.) could influence intent weights or special dialogue
- [ ] Weakness field (e.g. "Fire weakness", "Ice weakness") could be exploited by certain card types
- [ ] No animation between screen transitions — a fade would improve feel
- [ ] Sound effects / music hooks
