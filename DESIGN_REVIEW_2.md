# Comic Spire — Design Review II
*Reviewed: 2026-03-21 | Post-Implementation Pass*

---

## Overview

This review covers the current state of the game after the first major implementation sprint:
evilness system, versus screen, projected damage display, enemy DEF/player DEF stats,
expanded event pool, alignment-based enemy filtering, and map connector clarity.

The foundation is solid. The concerns below are ordered roughly by impact on player experience.

---

## 1. Critical Balance Issues

### 1.1 CHANNEL Burst Has No Cap
**Problem:** CHANNEL accumulates stacks from multiple cards per turn, then releases at end of turn as piercing damage that ignores ALL block and also applies Weaken. There is no ceiling. With a deck of 4–5 channel cards and the Focus Crystal relic (+30%), a single turn can output 80–120 pierce damage, one-shotting any non-boss enemy and trivialing most bosses.

**Fix:** Add a hard cap of 40 stacks before relic modifiers. Or make the burst deal 70% as pierce and 30% as normal damage (blockable). This preserves the fantasy while preventing instant-win turns.

---

### 1.2 COMBO Bonus Scales Unboundedly Within a Turn
**Problem:** Each attack in the same turn adds +3/+4 to the next. With Spiked Gauntlets (+4) and a hand full of combo cards, late-game attacks routinely deal 40–70+ raw damage before defense mitigation. This makes physical damage outperform magic by a wide margin despite magic's pierce.

**Fix:** Implement the cap from DESIGN_REVIEW.md §4.2: the combo bonus applied to any single card tops out at `+12` total (or `+15` with Spiked Gauntlets). Optionally show the cap in the card tooltip.

---

### 1.3 Player DEF Grows Too Fast
**Problem:** Player DEF starts at 2 and gains +1 per victory (potLv). With 14 floors, by endgame the player has DEF 16. Physical enemy attacks are mitigated by the full DEF flat, meaning an attack dealing 18 damage after stats is reduced to 2. Enemies effectively stop doing physical damage in the second half of a run.

**Fix:** DEF gain should be +1 every *other* level (floors 3, 6, 9, 12) rather than every level, maxing at roughly 5–6 by floor 14. Alternatively, change the reduction formula from `max(1, dmg - pDef)` to `max(1, dmg * (1 - pDef * 0.04))` so it scales as a percentage cap (16 DEF = 64% reduction, reasonable).

---

### 1.4 Blood Cards Are Undertuned Late Game
**Problem:** Blood costs 5 HP (3 with Blood Ruby) and 0 energy but deals roughly the same damage as a 1-cost attack card. At 55 HP base the 5 HP cost is ~9% of health. By floor 10 with 75+ HP from level-ups, it's 6.5%. The relic cost (1 relic slot for Blood Ruby) outweighs the benefit compared to just playing a 1-cost card.

**Fix:** Blood cards should scale their base value slightly with floor or with player HP (e.g., `value + floor(maxHp * 0.06)`). This makes them consistently high-risk/high-reward throughout the run.

---

### 1.5 FRENZY Is Always Worth It
**Problem:** Frenzy costs 0 energy, takes 2 panel slots, and deals respectable damage. The "two slot" cost only matters when you want to play 3+ cards per turn. In most turns with 3 energy, frenzy is strictly better than two 1-cost cards. The risk/reward is skewed.

**Fix:** Frenzy should have a mandatory HP cost of 3 (not a keyword card type — a hard mechanical rule). This makes it genuinely double-edged rather than a free upgrade.

---

## 2. Evilness System — Implementation Gaps

### 2.1 Alignment Shifts Are Too Slow
**Problem:** Evilness shifts by ±1–2 per card played per turn. Starting at 50, a player must play frenzy/blood/corrode cards for ~25+ turns to reach CORRUPT (100). In practice most runs stay in the ROGUE (41–59) band forever, meaning the hero/villain alignment bonuses and enemy filtering never activate.

**Fix:** Scale shifts by 1.5×, or add a one-time larger shift when the player *crosses* a threshold (e.g., absorbing the first villain card gives +8, the first hero card gives −8) to push players into an alignment faster. Events with large shifts (±6–8) are already in place; the per-turn micro-shifts need to be stronger to matter.

---

### 2.2 Events Don't Filter by Alignment
**Problem:** All 14 events appear uniformly regardless of evilness. A CORRUPT player can still get "Wounded Civilian" (a clearly hero-coded event) and a RIGHTEOUS player can get "Villain's Cache." This breaks narrative coherence.

**Fix:** Tag events with `align: 'hero' | 'villain' | 'neutral'` and filter the pool:
- Hero alignment (≤40): draw from neutral + hero events, rarely villain
- Villain alignment (≥60): draw from neutral + villain events, rarely hero
- Neutral: all events

The current EVENTS array already has natural splits — Wounded Civilian, Hero Code, Fan Encounter, and Crisis Hotline are hero-coded; Villain's Cache, Dark Merchant, Hostage Situation, and Suspicious Alley are villain-coded. This just needs a tag field and a filter in `handleEvent`.

---

### 2.3 No Passive Alignment Bonuses in Combat
**Problem:** The DESIGN_REVIEW.md §3.4 describes passive combat bonuses (RIGHTEOUS: +3 block/turn; CORRUPT: +1 to all poison stacks). These are never implemented. Alignment has no in-combat effect beyond which enemies you face.

**Fix (smallest first):**
1. At `bReduce INIT`, check alignment. If RIGHTEOUS, add 3 to initial block.
2. At `bReduce END_TURN` (poison tick), if CORRUPT, add 1 corrodeStack to enemy each turn.
3. Show both passives in the combat HUD so players know they're active.

---

### 2.4 Boss Variation Not Implemented
**Problem:** The versus screen shows boss/elite/normal enemies, but boss selection doesn't vary by alignment — it just picks from the strongest heroes regardless of hero/villain status (within the already-aligned pool). The design calls for alignment-specific final boss encounters.

**Fix:** In `pickEnemy`, when `isBoss=true`, add a separate boss name and fight modifier by alignment:
- `evilness < 35`: Final boss gets a "Righteous Wrath" buff (+25% block per turn, drops a legendary hero amp)
- `evilness > 65`: Final boss gets "Council of Heroes" — two sequential hero enemies, large gold reward
- Neutral: One balanced boss, moderate reward

This only requires tagging the boss encounter in `pickEnemy` and handling sequential battles (two-stage boss).

---

## 3. UX / Readability Problems

### 3.1 No Enemy Intent Legend
**Problem:** The enemy plan displays icon blobs (⚔️🛡️💜 etc.) but there's no legend. New players cannot read what the enemy will do. The versus screen shows stats but not action types.

**Fix:** Add a floating collapsible legend in the bottom-right of the battle screen:
```
⚔️ Physical Attack    💜 Magic Attack
🛡️ Defend/Block      🌿 Poison
💛 Self-Buff          💙 Channel
```
This can be a simple `<details>` element styled to match the game's font.

---

### 3.2 Keyword Tooltips Are Incomplete
**Problem:** The `tooltip` state variable exists in the code but the feature is never activated. Cards show keyword badges (e.g., `COMBO`, `CHANNEL`) but tapping/hovering them does nothing.

**Fix:** Wire the existing `tooltip` state to the `<KW>` keyword badge component with an `onClick` handler that shows a popup with the keyword's full description. The keyword descriptions are already written in the code (used for card descriptions). This is a single-pass UI wiring task.

---

### 3.3 Projected Damage Doesn't Account for CORRODE
**Problem:** `calcProjectedDmg` computes effective damage against enemy block and DEF but doesn't include corrode stacks as part of poison display. A poison card shows `+5 poison` but the enemy might have 8 corrode stacks — the player has no way to see total poison-per-tick from the card tooltip.

**Fix:** For poison-type cards, the projected label should read:
`+5 poison (→ 13 total)` where 13 = existing stacks + new stacks.

---

### 3.4 Grid Is Still Confusing After Placing Cards
**Problem:** The 2×2 grid is visually appealing but it's not always obvious how multi-slot cards (h2, frenzy) interact with single-slot cards. Players discover the layout rules by trial and error.

**Fix:** Add a 1-line hint under the grid on the first 3 turns: `"Wide cards (FRENZY) take 2 slots in a row."` Dismiss permanently after the hint is shown.

---

### 3.5 Evilness Bar Doesn't Signal Threshold Crossings
**Problem:** The evilness bar shifts silently. When you cross from ROGUE to RUTHLESS (≥60) nothing alerts the player that enemy types have changed, that new shop items are available, or that alignment passives have activated.

**Fix:** Show a brief centered notification (2 seconds, similar to the battle log floaters) when alignment tier changes: `"⚡ ALIGNMENT SHIFT → RUTHLESS"` with the appropriate color. This is low effort and high feedback value.

---

## 4. Progression & Economy

### 4.1 Gold Has No Late-Game Sink
**Problem:** By floor 10+ the shop rarely offers anything the player can't already do. Gold accumulates with nothing to spend it on. A player can finish a run with 90+ gold unspent.

**Fix (choose one or more):**
- **Card removal:** Always offer "Remove a basic card — 25 gold" at every shop. Card compression is universally valuable.
- **HP purchase:** "Buy 15 HP — 20 gold" as a permanent shop option.
- **Relic upgrade:** "Upgrade your weakest Amp — 40 gold" (bump one relic to a stronger tier).
- **Extra event choice:** "Spend 30 gold to unlock a hidden event option" (a meta-choice).

---

### 4.2 Meta-Progression Is Entirely Absent
**Problem:** `potLv` increments on victory and affects HP/DEF on the *next* run's level-ups (since it's reset to 1 each `startGame`). No unlocks, codex discoveries, or persistent rewards exist despite the codex panel being implemented.

**Fix (localStorage-based):**
```js
// On first boss kill:
localStorage.setItem('cs_unlockedHardMode', 'true');
// On CORRUPT run finish:
// unlock 3 villain starter cards
// Show on title screen in the existing Codex panel
```
The codex panel exists — it just needs unlock entries. Start with 3-4 unlocks tied to achievable milestones.

---

### 4.3 Absorb Phase Has No "Skip" Option
**Problem:** After every battle the player must absorb exactly 1 of 3 offered cards. They cannot skip (e.g., if all 3 are unwanted). Forced card acquisition leads to bloated decks.

**Fix:** Add a "Skip — take 15 gold instead" button in the absorb phase. This gives a meaningful trade-off and helps players preserve deck quality.

---

## 5. Dead Code & Technical Debt

### 5.1 `startPois` Relic Effect Is Wired But Unused
**Problem:** `bReduce INIT` checks `hasR('startPois')` but no relic in `ALL_RELICS` has `fx: 'startPois'`. The code branch is dead.

**Fix:** Either add a "Plague Vial" relic (`fx: 'startPois'`, 3 corrode stacks at battle start) or remove the check from `bReduce`. Given that CORRODE is a core villain keyword, the relic fits the villain shop pool.

---

### 5.2 `tooltip` State Is Never Shown
**Problem:** `const [tooltip, setTooltip] = useState(null)` exists but nothing reads `tooltip` to render a popup.

**Fix:** Either implement keyword tooltips (see §3.2) or remove the state and its setter to reduce confusion.

---

### 5.3 r11 Slot Is Empty
**Problem:** ALL_RELICS skips from r10 to r12 (r11 "Death Wish" was removed with desperate mode). The IDs are used as stable keys and the gap is harmless, but it's confusing.

**Fix:** Either fill r11 with the new `startPois` relic (Plague Vial) or document the gap as intentional.

---

### 5.4 `enemyCache` Ref Never Populated
**Problem:** `useRef({})` is declared as `enemyCache` but nothing writes to it. Its original intent (cache generated enemies per node so revisiting gives the same enemy) is a good idea but unimplemented.

**Fix:** In `pickEnemy` (or wherever enemy objects are created for a node), cache by nodeId:
```js
if(enemyCache.current[nodeId]) return enemyCache.current[nodeId];
const en = makeEnemy(...);
enemyCache.current[nodeId] = en;
return en;
```
This also prevents the versus screen from showing a different enemy each time you hover a node.

---

### 5.5 `animPhase` Is Set But Never Read Meaningfully
**Problem:** `animPhase` is set to `'r'` during endTurn but nothing reads it to drive animations beyond a brief CSS class.

**Fix:** Either expand it into a proper animation state machine (each card resolve = one phase) or remove it and keep only the CSS `resolving` class on the grid.

---

### 5.6 `l2` Shape Is Never Used
**Problem:** The L-shaped 2-card variant is defined in the shape table but `makeEnemyDeck` and `getSignature` never generate cards with it.

**Fix:** Assign `l2` to specific archetypes (e.g., the Strength/physical archetype) to add visual variety to enemy decks without any gameplay change.

---

## 6. Quick Win Summary

| Change | Effort | Impact |
|--------|--------|--------|
| Add event `align` tags + filter pool | Low | High — narrative coherence |
| CHANNEL cap at 40 stacks | Low | High — prevent one-turn kills |
| Alignment tier-crossing notification | Low | High — player clarity |
| Add `startPois` relic (Plague Vial) | Low | Medium — fills dead code, villain synergy |
| Fix player DEF scaling | Low | High — late-game enemy relevance |
| Wire `tooltip` to keyword badges | Medium | High — new player accessibility |
| Enemy intent legend | Low | High — accessibility |
| Absorb "skip for gold" option | Low | Medium — deck control |
| Gold shop sinks (remove/HP/upgrade) | Low | High — late economy |
| Corrode total shown in projDmg | Low | Medium — transparency |
| Cache enemies per node (`enemyCache`) | Low | Medium — versus screen stability |
| Event passive alignment bonuses (RIGHTEOUS block, CORRUPT poison) | Medium | High — alignment has teeth |
| Meta-progression via localStorage | Medium | High — replayability |
| COMBO cap at +12 | Low | High — physical balance |
| Boss variation by alignment | High | High — run climax variety |

---

## 7. Priority Order

1. **CHANNEL cap** — prevents run-breaking turns immediately
2. **COMBO cap** — same rationale
3. **Player DEF scaling fix** — restores late-game enemy relevance
4. **Event alignment filter** — high-impact, low-effort narrative improvement
5. **Alignment tier notification** — clarity on system activation
6. **Passive alignment bonuses in combat** — makes alignment choice meaningful in combat
7. **Keyword tooltip wiring** — new player accessibility
8. **Gold sinks** — late economy
9. **Meta-progression** — replayability
10. **Boss variation by alignment** — run climax payoff
