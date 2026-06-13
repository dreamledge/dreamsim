# NBA 2K Draft Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified lottery, draft order, and player saving with NBA 2K's exact mechanics while keeping the existing multiplayer infrastructure.

**Architecture:** Modify `LeagueDraft.jsx` to implement the exact NBA lottery odds table (1,000 combinations), 2-round snake draft (15 for expansion), 120-second timer, and preserve original player data on save. Add a `generateRookies()` function to `nbaPlayers.js` for season 2+ rookie pools.

**Tech Stack:** React, Firebase/Firestore, JavaScript ES modules

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/pages/LeagueDraft.jsx` | Modify | Lottery logic, draft order, timer, player data preservation |
| `frontend/src/engine/nbaPlayers.js` | Modify | Add `generateRookies()` function for season 2+ |
| `frontend/src/engine/gameEngine.js` | Modify | Re-export `generateRookies` |

---

## Task 1: Implement Exact NBA Lottery System

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:41-63`

- [ ] **Step 1: Replace `generateLotteryOrder()` with exact NBA odds**

Replace the entire `generateLotteryOrder` function (lines 41-63) with:

```javascript
const LOTTERY_ODDS = [
  { seed: 1, combinations: 140 },  // 14.0%
  { seed: 2, combinations: 140 },  // 14.0%
  { seed: 3, combinations: 140 },  // 14.0%
  { seed: 4, combinations: 125 },  // 12.5%
  { seed: 5, combinations: 105 },  // 10.5%
  { seed: 6, combinations: 90 },   // 9.0%
  { seed: 7, combinations: 75 },   // 7.5%
  { seed: 8, combinations: 60 },   // 6.0%
  { seed: 9, combinations: 45 },   // 4.5%
  { seed: 10, combinations: 30 },  // 3.0%
  { seed: 11, combinations: 20 },  // 2.0%
  { seed: 12, combinations: 15 },  // 1.5%
  { seed: 13, combinations: 10 },  // 1.0%
  { seed: 14, combinations: 5 },   // 0.5%
];

function generateLotteryOrder(teamList) {
  if (teamList.length === 0) return [];

  const allZeroWins = teamList.every(t => !t.wins);
  if (allZeroWins) return shuffle(teamList);

  const sorted = [...teamList].sort((a, b) => (a.wins || 0) - (b.wins || 0));

  if (sorted.length <= 4) {
    return shuffle(sorted);
  }

  const lotteryTeams = sorted.slice(0, Math.min(14, sorted.length));
  const nonLotteryTeams = sorted.slice(Math.min(14, sorted.length));

  const oddsToUse = LOTTERY_ODDS.slice(0, lotteryTeams.length);

  let combinationPool = [];
  for (const { seed, combinations } of oddsToUse) {
    const teamIndex = seed - 1;
    if (teamIndex < lotteryTeams.length) {
      for (let i = 0; i < combinations; i++) {
        combinationPool.push(lotteryTeams[teamIndex]);
      }
    }
  }

  const drawn = [];
  const remainingCombinations = [...combinationPool];

  for (let pick = 0; pick < 4 && remainingCombinations.length > 0; pick++) {
    const winnerIndex = Math.floor(Math.random() * remainingCombinations.length);
    const winner = remainingCombinations[winnerIndex];
    drawn.push(winner);

    remainingCombinations.splice(
      remainingCombinations.findIndex(t => t.id === winner.id),
      1
    );

    lotteryTeams.splice(lotteryTeams.findIndex(t => t.id === winner.id), 1);
  }

  const remainingLottery = lotteryTeams;

  return [...drawn, ...remainingLottery, ...nonLotteryTeams];
}
```

- [ ] **Step 2: Verify lottery produces correct odds**

Open browser console and run:
```javascript
// Test: Run 1000 simulations, count how often seed 1 gets pick 1
const testTeams = Array.from({length: 14}, (_, i) => ({id: `t${i}`, wins: i}));
const counts = {};
for (let i = 0; i < 1000; i++) {
  const order = generateLotteryOrder(testTeams);
  const first = order[0].id;
  counts[first] = (counts[first] || 0) + 1;
}
console.log(counts);
// Expected: t0 (seed 1) should appear ~140 times (14%)
```

Expected: `t0` appears ~140 times, `t1` ~140 times, `t2` ~140 times, `t3` ~125 times.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LeagueDraft.jsx
git commit -m "feat: implement exact NBA 2K lottery odds (1000 combinations)"
```

---

## Task 2: Update Draft Round Logic (2 rounds standard, 15 expansion)

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:294-295`

- [ ] **Step 1: Change total rounds from 3 to 2 for non-expansion**

Find this line in `handleSchedule` (line 294):
```javascript
const totalRounds = hasPlayers ? 3 : 15;
```

Replace with:
```javascript
const totalRounds = hasPlayers ? 2 : 15;
```

Note: `hasPlayers` is `true` when teams already have players (season 2+), so 2 rounds. `false` for expansion (season 1), so 15 rounds.

- [ ] **Step 2: Update all hardcoded `3` references to use `draft.totalRounds`**

In `handleStartDraft` (line 337), change:
```javascript
const totalRounds = draft.totalRounds || 3;
```
to:
```javascript
const totalRounds = draft.totalRounds || 2;
```

In `handlePick` (line 442), change:
```javascript
const realTotalPicks = teams.length * (freshDraft?.totalRounds || 3);
```
to:
```javascript
const realTotalPicks = teams.length * (freshDraft?.totalRounds || 2);
```

In `handleAutoPick` (line 522), change:
```javascript
const realTotalPicks = teams.length * (freshDraft2?.totalRounds || 3);
```
to:
```javascript
const realTotalPicks = teams.length * (freshDraft2?.totalRounds || 2);
```

In the `computedTotalPicks` variable (line 587), change:
```javascript
const computedTotalPicks = teams.length * (draft?.totalRounds || 3);
```
to:
```javascript
const computedTotalPicks = teams.length * (draft?.totalRounds || 2);
```

- [ ] **Step 3: Update UI text to say "2 rounds" instead of "3 rounds"**

In `renderSetup` (line 623), change:
```javascript
<p>• {season?.seasonNumber === 1 && season?.status === 'pregame' ? '15 rounds (expansion)' : '3 rounds'}, snake order</p>
```
to:
```javascript
<p>• {draft?.totalRounds > 3 ? '15 rounds (expansion)' : `${draft?.totalRounds || 2} rounds`}, snake order</p>
```

In `renderScheduled` (line 649), change:
```javascript
<p>• {draft?.totalRounds > 3 ? '15 rounds (expansion)' : '3 rounds'}, snake order</p>
```
to:
```javascript
<p>• {draft?.totalRounds > 3 ? '15 rounds (expansion)' : `${draft?.totalRounds || 2} rounds`}, snake order</p>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LeagueDraft.jsx
git commit -m "feat: change default draft rounds from 3 to 2 (NBA 2K standard)"
```

---

## Task 3: Update Pick Timer to 120 Seconds

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:90,204,302`

- [ ] **Step 1: Change default timer state from 90 to 120**

Find line 90:
```javascript
const [timeLeft, setTimeLeft] = useState(90);
```

Replace with:
```javascript
const [timeLeft, setTimeLeft] = useState(120);
```

- [ ] **Step 2: Update timer calculation to use 120 seconds**

Find line 204:
```javascript
const remaining = Math.max(0, 90 - elapsed);
```

Replace with:
```javascript
const remaining = Math.max(0, 120 - elapsed);
```

- [ ] **Step 3: Update timer reset to use 120 seconds**

Find line 183:
```javascript
if (!draft || draft.status !== 'live') { setTimeLeft(90); return; }
```

Replace with:
```javascript
if (!draft || draft.status !== 'live') { setTimeLeft(120); return; }
```

- [ ] **Step 4: Update draft settings storage to use 120 seconds**

Find line 302:
```javascript
pickTimeLimit: 90,
```

Replace with:
```javascript
pickTimeLimit: 120,
```

- [ ] **Step 5: Update UI text to show "120 seconds"**

In `renderSetup` (line 625), change:
```javascript
<p>• 90 seconds per pick</p>
```
to:
```javascript
<p>• 120 seconds per pick</p>
```

In `renderScheduled` (line 651), change:
```javascript
<p>• 90 seconds per pick</p>
```
to:
```javascript
<p>• 120 seconds per pick</p>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LeagueDraft.jsx
git commit -m "feat: increase pick timer from 90 to 120 seconds (2K default)"
```

---

## Task 4: Preserve Original Player Data on Draft Save

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:423-457,539-578`

- [ ] **Step 1: Store full player object in `handlePick`**

In `handlePick` (line 429-434), replace:
```javascript
await updateDoc(draftPickDoc(id, draft.id, pickId), {
  playerId: player.id,
  playerName: `${player.firstName} ${player.lastName}`,
  status: 'picked',
  pickedAt: new Date().toISOString(),
});
```

With:
```javascript
await updateDoc(draftPickDoc(id, draft.id, pickId), {
  playerId: player.id,
  playerName: `${player.firstName} ${player.lastName}`,
  playerData: { ...player },
  status: 'picked',
  pickedAt: new Date().toISOString(),
});
```

- [ ] **Step 2: Store full player object in `handleAutoPick`**

In `handleAutoPick` (line 507-512), replace:
```javascript
await updateDoc(draftPickDoc(id, draft.id, pickId), {
  playerId: best.id,
  playerName: `${best.firstName} ${best.lastName}`,
  status: 'auto',
  pickedAt: new Date().toISOString(),
});
```

With:
```javascript
await updateDoc(draftPickDoc(id, draft.id, pickId), {
  playerId: best.id,
  playerName: `${best.firstName} ${best.lastName}`,
  playerData: { ...best },
  status: 'auto',
  pickedAt: new Date().toISOString(),
});
```

- [ ] **Step 3: Rewrite `saveDraftedPlayers()` to use original data**

Replace the entire `saveDraftedPlayers` function (lines 539-578) with:

```javascript
const saveDraftedPlayers = async () => {
  const dSnap = await getDocs(query(draftPicksCol(id, draft.id), orderBy('order')));
  const finalPicks = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const pick of finalPicks) {
    if (!pick.playerId || pick.status === 'waiting') continue;
    const team = teams.find(t => t.id === pick.teamId);
    if (!team) continue;

    const pSnap = await getDocs(teamPlayersCol(team.id));
    const existing = pSnap.docs.length;

    const pd = pick.playerData || {};

    await setDoc(doc(teamPlayersCol(team.id), pick.playerId), {
      id: pick.playerId,
      firstName: pd.firstName || pick.playerName?.split(' ')[0] || 'Player',
      lastName: pd.lastName || pick.playerName?.split(' ').slice(1).join(' ') || 'Unknown',
      primaryPosition: pd.primaryPosition || pd.position || 'SF',
      canPlay: pd.canPlay || ['PG', 'SG', 'SF', 'PF', 'C'],
      overall: pd.overall || 50,
      age: pd.age || 22,
      height: pd.height || 78,
      weight: pd.weight || 210,
      offense: pd.offense || 50,
      defense: pd.defense || 50,
      shooting: pd.shooting || 50,
      playmaking: pd.playmaking || 50,
      rebounding: pd.rebounding || 50,
      athleticism: pd.athleticism || 50,
      potential: pd.potential || 75,
      nbaTeam: pd.nbaTeam || null,
      statsPpg: pd.statsPpg || 0,
      statsRpg: pd.statsRpg || 0,
      statsApg: pd.statsApg || 0,
      statsSpg: pd.statsSpg || 0,
      statsBpg: pd.statsBpg || 0,
      statsFgPct: pd.statsFgPct || 0.45,
      statsThreePct: pd.statsThreePct || 0.33,
      teamId: team.id,
      seasonId: league?.currentSeason || 1,
      isStarter: existing < 5 ? 1 : 0,
      lineupPosition: existing < 5 ? existing : null,
      isRookie: pd.isRookie || false,
    });
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LeagueDraft.jsx
git commit -m "feat: preserve original player attributes when saving drafted players"
```

---

## Task 5: Add Rookie Generation for Season 2+

**Files:**
- Modify: `frontend/src/engine/nbaPlayers.js:516-521`
- Modify: `frontend/src/engine/gameEngine.js:2`

- [ ] **Step 1: Add `generateRookies()` function to `nbaPlayers.js`**

Add the following function at the end of `nbaPlayers.js` (after line 521, before `parseHeight`):

```javascript
const FIRST_NAMES = [
  'Marcus', 'Jaylen', 'Tyrese', 'Jalen', 'Anthony', 'DeAndre', 'Cam', 'Jordan',
  'Kyle', 'Tyler', 'Derrick', 'Malik', 'Isaiah', 'Devin', 'Trae', 'Ja',
  'Zion', 'RJ', 'Cole', 'Cade', 'Scottie', 'Evan', 'Alperen', 'Franz',
  'Jabari', 'Chet', 'Paolo', 'Keegan', 'Bennedict', 'Jaden', 'Walker',
  'Dyson', 'Tari', 'MarJon', 'Christian', 'Kennedy', 'Ayo', 'Tre',
  'Davion', 'James', 'Jonathan', 'Usman', 'Day\'Ron', 'Quentin', 'Herbert',
  'Santi', 'Xavier', 'Trey', 'Keon', 'Jalen', 'Caris', 'Deni', 'Patrick',
];

const LAST_NAMES = [
  'Williams', 'Johnson', 'Brown', 'Davis', 'Smith', 'Jackson', 'Thompson',
  'Morris', 'Green', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Hill', 'Barnes',
  'Adams', 'Nelson', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans',
  'Turner', 'Torres', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Flores',
  'Morris', 'Nguyen', 'Murphy', 'Rivera', 'Cook', 'Rogers', 'Morgan',
  'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Kelly',
  'Howard', 'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood', 'Watson',
];

const COLLEGE_NAMES = [
  'Duke', 'Kentucky', 'Kansas', 'Gonzaga', 'UCLA', 'Michigan', 'North Carolina',
  'Villanova', 'Baylor', 'Houston', 'Purdue', 'Arizona', 'Texas', 'Arkansas',
  'Auburn', 'Tennessee', 'Illinois', 'Connecticut', 'Oregon', 'USC',
  'Alabama', 'Iowa State', 'TCU', 'Xavier', 'Memphis', 'San Diego State',
  'Florida Atlantic', 'Princeton', 'Florida', 'Maryland', 'Indiana',
];

const ARCHETYPE_DISTRIBUTION = [
  { position: 'PG', weight: 18 },
  { position: 'SG', weight: 20 },
  { position: 'SF', weight: 22 },
  { position: 'PF', weight: 20 },
  { position: 'C', weight: 20 },
];

const POSITION_MEASURABLES = {
  PG: { heightMin: 72, heightMax: 76, weightMin: 175, weightMax: 200, wingspanMin: 76, wingspanMax: 80 },
  SG: { heightMin: 75, heightMax: 78, weightMin: 190, weightMax: 215, wingspanMin: 78, wingspanMax: 82 },
  SF: { heightMin: 77, heightMax: 81, weightMin: 200, weightMax: 230, wingspanMin: 80, wingspanMax: 85 },
  PF: { heightMin: 79, heightMax: 83, weightMin: 220, weightMax: 250, wingspanMin: 83, wingspanMax: 87 },
  C: { heightMin: 81, heightMax: 84, weightMin: 240, weightMax: 275, wingspanMin: 84, wingspanMax: 89 },
};

function pickWeightedPosition() {
  const totalWeight = ARCHETYPE_DISTRIBUTION.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * totalWeight;
  for (const { position, weight } of ARCHETYPE_DISTRIBUTION) {
    r -= weight;
    if (r <= 0) return position;
  }
  return 'SF';
}

function randomRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRookieAttributes(position, overallTarget) {
  const base = overallTarget;
  const variance = () => Math.floor(Math.random() * 10) - 5;

  const offense = Math.max(30, Math.min(99, base + variance()));
  const defense = Math.max(30, Math.min(99, base + variance()));
  const shooting = Math.max(30, Math.min(99, base + variance()));
  const playmaking = Math.max(30, Math.min(99, base + variance()));
  const rebounding = Math.max(30, Math.min(99, base + variance()));
  const athleticism = Math.max(30, Math.min(99, base + variance()));

  const statScale = base / 100;
  const ppg = Math.round((8 + Math.random() * 18) * statScale * 10) / 10;
  const rpg = Math.round((2 + Math.random() * 10) * statScale * 10) / 10;
  const apg = Math.round((1 + Math.random() * 8) * statScale * 10) / 10;
  const spg = Math.round((0.3 + Math.random() * 2) * statScale * 10) / 10;
  const bpg = Math.round((0.1 + Math.random() * 2) * statScale * 10) / 10;

  return {
    offense, defense, shooting, playmaking, rebounding, athleticism,
    ppg, rpg, apg, spg, bpg,
    statsFgPct: Math.round((0.38 + Math.random() * 0.12) * 100) / 100,
    statsThreePct: Math.round((0.28 + Math.random() * 0.14) * 100) / 100,
  };
}

export function generateRookies(count = 75) {
  const rookies = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    let firstName, lastName, fullName;
    do {
      firstName = randomFrom(FIRST_NAMES);
      lastName = randomFrom(LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const position = pickWeightedPosition();
    const measurables = POSITION_MEASURABLES[position];

    const overallRoll = Math.random();
    let overall;
    if (overallRoll < 0.05) overall = randomRange(80, 85);
    else if (overallRoll < 0.20) overall = randomRange(75, 79);
    else if (overallRoll < 0.50) overall = randomRange(70, 74);
    else if (overallRoll < 0.80) overall = randomRange(65, 69);
    else overall = randomRange(55, 64);

    const age = randomRange(19, 22);
    const height = randomRange(measurables.heightMin, measurables.heightMax);
    const weight = randomRange(measurables.weightMin, measurables.weightMax);
    const wingspan = randomRange(measurables.wingspanMin, measurables.wingspanMax);

    const potentialRoll = Math.random();
    let potential;
    if (overall >= 80) potential = randomFrom(['A+', 'A', 'A-']);
    else if (overall >= 75) potential = randomFrom(['A-', 'B+', 'B']);
    else if (overall >= 70) potential = randomFrom(['B', 'B-', 'C+']);
    else if (overall >= 65) potential = randomFrom(['C+', 'C', 'C-']);
    else potential = randomFrom(['C-', 'D+', 'D']);

    const attrs = generateRookieAttributes(position, overall);

    const id = `rookie_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;

    rookies.push({
      id,
      firstName,
      lastName,
      position: position,
      primaryPosition: position,
      canPlay: [position],
      nbaTeam: null,
      age,
      height,
      weight,
      wingspan,
      overall,
      potential,
      offense: attrs.offense,
      defense: attrs.defense,
      shooting: attrs.shooting,
      playmaking: attrs.playmaking,
      rebounding: attrs.rebounding,
      athleticism: attrs.athleticism,
      statsPpg: attrs.ppg,
      statsRpg: attrs.rpg,
      statsApg: attrs.apg,
      statsSpg: attrs.spg,
      statsBpg: attrs.bpg,
      statsFgPct: attrs.statsFgPct,
      statsThreePct: attrs.statsThreePct,
      statsFtPct: Math.round((0.65 + Math.random() * 0.2) * 100) / 100,
      statsGamesPlayed: 0,
      college: randomFrom(COLLEGE_NAMES),
      injuryProne: Math.floor(Math.random() * 30),
      morale: 50 + Math.floor(Math.random() * 30),
      contractYears: 4,
      contractValue: Math.round((overall / 99) * 12000000),
      isInjured: false,
      injuryWeeks: 0,
      isRookie: true,
    });
  }

  return rookies;
}
```

- [ ] **Step 2: Re-export `generateRookies` from `gameEngine.js`**

In `gameEngine.js` line 2, change:
```javascript
import { draftNbaPlayers, ensureNbaPool, getNbaPlayerPool, getPoolSize } from './nbaPlayers';
```

To:
```javascript
import { draftNbaPlayers, ensureNbaPool, getNbaPlayerPool, getPoolSize, generateRookies } from './nbaPlayers';
```

Add at the end of `gameEngine.js` (after the last function):
```javascript
export { generateRookies };
```

- [ ] **Step 3: Verify rookie generation produces correct distribution**

Open browser console and run:
```javascript
const rookies = generateRookies(100);
const positions = {};
rookies.forEach(r => { positions[r.position] = (positions[r.position] || 0) + 1; });
console.log('Positions:', positions);
console.log('Age range:', Math.min(...rookies.map(r => r.age)), '-', Math.max(...rookies.map(r => r.age)));
console.log('Overall range:', Math.min(...rookies.map(r => r.overall)), '-', Math.max(...rookies.map(r => r.overall)));
console.log('All have isRookie:', rookies.every(r => r.isRookie));
```

Expected: Positions roughly 18/20/22/20/20 split, age 19-22, overall 55-85, all have `isRookie: true`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/engine/nbaPlayers.js frontend/src/engine/gameEngine.js
git commit -m "feat: add rookie prospect generation for season 2+ drafts"
```

---

## Task 6: Integrate Rookie Pool into Season 2+ Drafts

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:23-26,312-328`

- [ ] **Step 1: Import `generateRookies` in `LeagueDraft.jsx`**

Change line 7:
```javascript
import { draftNbaPlayers, ensureNbaPool, getPoolSize } from '../engine/gameEngine';
```

To:
```javascript
import { draftNbaPlayers, ensureNbaPool, getPoolSize, generateRookies } from '../engine/gameEngine';
```

- [ ] **Step 2: Update `generateAvailablePlayers` to mix in rookies for season 2+**

Replace the `generateAvailablePlayers` function (lines 23-26) with:

```javascript
async function generateAvailablePlayers(count, isExpansion = false) {
  await ensureNbaPool();
  const nbaPlayers = await draftNbaPlayers(count);

  if (!isExpansion) {
    const rookieCount = Math.ceil(count * 0.25);
    const rookies = generateRookies(rookieCount);
    return [...nbaPlayers, ...rookies];
  }

  return nbaPlayers;
}
```

- [ ] **Step 3: Update `handleSchedule` to pass expansion flag**

In `handleSchedule` (line 314), change:
```javascript
const players = await generateAvailablePlayers(count);
```

To:
```javascript
const players = await generateAvailablePlayers(count, totalRounds <= 2);
```

- [ ] **Step 4: Update `handleStartDraft` pool generation fallback**

In `handleStartDraft` (line 382), change:
```javascript
const players = await generateAvailablePlayers(count);
```

To:
```javascript
const players = await generateAvailablePlayers(count, totalRounds <= 2);
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LeagueDraft.jsx
git commit -m "feat: mix rookie prospects into season 2+ draft pools"
```

---

## Task 7: Fix Timer Reset After Each Pick

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:182-213`

- [ ] **Step 1: Ensure timer resets to 120 on each new pick**

The current timer useEffect (line 182-213) already recalculates based on `pickStartedAt`, which is set on each new pick. The fix in Task 3 (changing 90 to 120) handles this. No additional changes needed.

Verify by checking that `pickStartedAt` is set in both `handlePick` (line 453) and `handleAutoPick` (line 533):
```javascript
pickStartedAt: new Date().toISOString(),
```

Both locations already set `pickStartedAt` on each new pick, so the timer will reset correctly.

- [ ] **Step 2: No commit needed (verified existing behavior)**

---

## Task 8: Update Draft Status Display for 2 Rounds

**Files:**
- Modify: `frontend/src/pages/LeagueDraft.jsx:595-631,634-688`

- [ ] **Step 1: Update setup display to show correct round info**

The setup and scheduled views already reference `draft?.totalRounds` dynamically. The changes in Task 2 handle updating the text. No additional changes needed.

- [ ] **Step 2: No commit needed (already handled in Task 2)**

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] Lottery draws exactly 4 picks using 1,000 combination pool
- [ ] Picks 5-14 go to remaining lottery teams in reverse standing order
- [ ] Worst team cannot fall below pick 5
- [ ] Draft uses 2 rounds for season 2+ (or 15 for expansion)
- [ ] Snake order reverses on even rounds
- [ ] Pick timer shows 2:00 (120 seconds)
- [ ] Timer resets to 120 on each new pick
- [ ] Auto-pick triggers at 0 seconds
- [ ] Drafted players preserve original overall, age, ratings
- [ ] Season 2+ drafts include ~25% rookies in the pool
- [ ] Rookies have correct position distribution (PG 18%, SG 20%, SF 22%, PF 20%, C 20%)
- [ ] Rookies have age 19-22 and overall 55-85
- [ ] All picks save correctly to Firestore with `playerData` field
- [ ] Draft completes and players appear on team rosters with original stats
