# Design: NBA 2K Draft Mechanics Implementation

**Date:** 2026-06-12
**Goal:** Make the multiplayer draft system work identically to NBA 2K's MyLEAGUE draft

---

## Summary

Replace the current simplified lottery, draft order, and player saving logic with NBA 2K's exact mechanics. Keep the existing multiplayer infrastructure, 516-player pool, and Firestore real-time sync. Focus on core mechanics only — no trades, no scouting system overhaul.

---

## 1. Lottery System

### Replace `generateLotteryOrder()` in `LeagueDraft.jsx`

**Current behavior:** Weighted random pool where each team gets `(totalTeams - rank) * 10` lottery balls.

**New behavior:** Exact NBA 2K lottery with 1,000 combinations.

#### Lottery Odds Table

| Seed | Record Rank | Combinations | Percentage |
|------|-------------|--------------|------------|
| 1    | Worst       | 140          | 14.0%      |
| 2    | 2nd worst   | 140          | 14.0%      |
| 3    | 3rd worst   | 140          | 14.0%      |
| 4    | 4th worst   | 125          | 12.5%      |
| 5    | 5th worst   | 105          | 10.5%      |
| 6    | 6th worst   | 90           | 9.0%       |
| 7    | 7th worst   | 75           | 7.5%       |
| 8    | 8th worst   | 60           | 6.0%       |
| 9    | 9th worst   | 45           | 4.5%       |
| 10   | 10th worst  | 30           | 3.0%       |
| 11   | 11th worst  | 20           | 2.0%       |
| 12   | 12th worst  | 15           | 1.5%       |
| 13   | 13th worst  | 10           | 1.0%       |
| 14   | Best of lot | 5            | 0.5%       |
| **Total** |         | **1,000**    | **100%**   |

#### Algorithm

```
1. Sort non-playoff teams by wins (ascending) → seeds 1-14
2. Build combination pool:
   - Assign combinations 1-140 to seed 1
   - Assign combinations 141-280 to seed 2
   - Assign combinations 281-420 to seed 3
   - Assign combinations 421-545 to seed 4
   - Assign combinations 546-650 to seed 5
   - Assign combinations 651-740 to seed 6
   - Assign combinations 741-815 to seed 7
   - Assign combinations 816-875 to seed 8
   - Assign combinations 876-920 to seed 9
   - Assign combinations 921-950 to seed 10
   - Assign combinations 951-970 to seed 11
   - Assign combinations 971-985 to seed 12
   - Assign combinations 986-995 to seed 13
   - Assign combinations 996-1000 to seed 14
3. Draw pick 1: Random combination from pool → team wins pick 1
4. Remove drawn combination from pool
5. Draw pick 2: Random combination from remaining pool → team wins pick 2
6. Remove drawn combination from pool
7. Draw pick 3: Random combination from remaining pool → team wins pick 3
8. Remove drawn combination from pool
9. Draw pick 4: Random combination from remaining pool → team wins pick 4
10. Remaining lottery teams: Assign picks 5-14 in reverse standing order
11. Anti-tank safeguard: Team with worst record cannot fall below pick 5
```

#### Edge Cases
- **Tie-breaking:** Teams with equal regular season records are assigned the same seed. For lottery purposes, tied teams within the lottery range flip a coin to determine which gets the higher seed (more combinations). The loser gets the lower seed.
- **Fewer than 14 non-playoff teams:** Only fill lottery slots for actual non-playoff teams. If league has <14 teams, all non-playoff teams are in the lottery. The odds table scales down proportionally (e.g., 10-team league uses seeds 1-10 with their respective odds).

---

## 2. Draft Order & Structure

### Draft Rounds
- **First season (expansion):** 15 rounds = `teams × 15` picks
- **Season 2+:** 2 rounds = `teams × 2` picks

### Snake Draft Order
- **Odd rounds (1, 3, 5...):** Normal order (lottery seed → reverse record → playoff teams)
- **Even rounds (2, 4, 6...):** Reversed order (last pick goes first)

### Pick Data Structure
```javascript
{
  pickNumber: Number,      // Sequential 1-60 (or 1-450)
  round: Number,           // 1-2 (or 1-15)
  teamId: String,          // Current picking team
  originalTeamId: String,  // Original pick owner (for trade tracking)
  playerName: String,      // null until picked
  playerId: String,        // null until picked
  playerData: Object,      // Full player object (preserved from pool)
  status: 'waiting' | 'picked' | 'auto',
  pickedAt: Timestamp | null
}
```

### Pick Timer
- **Duration:** 120 seconds per pick
- **Auto-pick:** Triggers `handleAutoPick()` at timeout
- **Timer reset:** Resets to 120s on each new pick
- **Display:** Countdown shown on draft screen

---

## 3. Player Data Preservation

### Problem
Current `saveDraftedPlayers()` (LeagueDraft.jsx line 539) re-creates player documents with randomized stats:
```javascript
overall: Math.floor(Math.random() * 35) + 50,  // 50-84
age: Math.floor(Math.random() * 7) + 19,       // 19-25
```
This discards the original pool data.

### Solution
1. **Store full player object in pick document** when a pick is made
2. **Copy ALL attributes** from the pick's `playerData` when saving to team roster
3. **Remove randomization** — use original overall, age, ratings, physicals, stats

### Updated Pick Execution
```javascript
// When pick is made:
await updateDoc(pickRef, {
  playerName: player.name,
  playerId: player.id,
  playerData: player,  // Full object preserved
  status: 'picked',
  pickedAt: serverTimestamp()
});

// When saving to roster:
const savedPlayer = {
  ...pick.playerData,  // All original attributes
  teamId: pick.teamId,
  rosterSpot: index,
  isStarter: index < 5
};
```

---

## 4. Season 2+ Rookie Generation

### When to Generate
- At the start of each new season (after season 1)
- Rookie pool generated before draft begins
- Mixed into available player pool for draft selection

### Rookie Specifications

#### Pool Size
- Standard: `teams × 2 × 1.25` (e.g., 30 teams = 75 rookies)
- Ensures enough prospects for 2-round draft + some undrafted

#### Position Distribution
| Position | Percentage | Example (75 rookies) |
|----------|------------|----------------------|
| PG       | 18%        | 14                   |
| SG       | 20%        | 15                   |
| SF       | 22%        | 17                   |
| PF       | 20%        | 15                   |
| C        | 20%        | 14                   |

#### Physical Measurables by Position
| Position | Height Range | Weight Range | Wingspan Range |
|----------|--------------|--------------|----------------|
| PG       | 6'0" - 6'4"  | 175-200 lbs  | 6'4" - 6'8"    |
| SG       | 6'3" - 6'6"  | 190-215 lbs  | 6'6" - 6'10"   |
| SF       | 6'5" - 6'9"  | 200-230 lbs  | 6'8" - 7'1"    |
| PF       | 6'7" - 6'11" | 220-250 lbs  | 6'11" - 7'3"   |
| C        | 6'9" - 7'0"  | 240-275 lbs  | 7'0" - 7'5"    |

#### Attribute Generation
- **Age:** 19-22 (weighted toward 20-21)
- **Overall:** 55-85 (weighted distribution):
  - 80-85: 5% (future stars)
  - 75-79: 15% (lottery picks)
  - 70-74: 30% (first round)
  - 65-69: 30% (second round)
  - 55-64: 20% (fringe/undrafted)
- **Potential:** Letter grades mapped to growth ceiling:
  - A+: 95-99 potential
  - A: 90-94
  - B+: 85-89
  - B: 80-84
  - C+: 75-79
  - C: 70-74
  - D+: 65-69
  - D: 60-64
- **Skills:** Generated within archetype parameters (shooters get higher shooting, bigs get higher rebounding, etc.)
- **College stats:** Randomized per-game averages consistent with overall rating

#### Rookie Object Structure
```javascript
{
  id: string,          // Generated unique ID
  firstName: string,
  lastName: string,
  position: string,
  height: string,
  weight: number,
  wingspan: string,
  age: number,
  overall: number,
  potential: string,   // Letter grade
  offense: number,
  defense: number,
  shooting: number,
  playmaking: number,
  rebounding: number,
  athleticism: number,
  ppg: number,
  rpg: number,
  apg: number,
  spg: number,
  bpg: number,
  fgPct: number,
  threePct: number,
  college: string,
  isRookie: true       // Flag to identify generated rookies
}
```

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `LeagueDraft.jsx` | Rewrite `generateLotteryOrder()`, update `handleStartDraft()` for 2-round logic, update `handlePick()` to preserve player data, update `saveDraftedPlayers()` to use original data, update timer to 120s |
| `nbaPlayers.js` | Add `generateRookies(count)` function for season 2+ rookie pool |
| `gameEngine.js` | Export rookie generation function |
| `aiEngine.js` | Update `generateDraftRecommendation()` if needed for rookie evaluation |

---

## 6. What Stays the Same

- Multiplayer infrastructure (Firestore real-time sync)
- 516-player NBA pool source (NBA2KLab)
- Draft scheduling system (`DraftDatePicker`)
- Scouting modal (`ScoutModal`)
- AI auto-pick logic (`findWeakestPosition`)
- Join draft flow (60-second join window)
- Draft status lifecycle (scheduled → joining → live → completed)

---

## 7. Testing Checklist

- [ ] Lottery generates correct odds (run 1000 simulations, verify distribution)
- [ ] Top 4 picks drawn by lottery, picks 5-14 by reverse standings
- [ ] Worst team cannot fall below pick 5
- [ ] Snake order reverses correctly on even rounds
- [ ] 2 rounds for season 2+, 15 rounds for expansion
- [ ] Pick timer is 120 seconds
- [ ] Auto-pick triggers at timer expiry
- [ ] Drafted players preserve original pool attributes
- [ ] Season 2+ generates 75 rookies with correct distributions
- [ ] Rookies mix into available pool for draft selection
- [ ] All picks save correctly to Firestore
- [ ] Draft completes and players appear on team rosters
