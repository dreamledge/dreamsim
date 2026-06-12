# Fix: Draft Pool Performance & Start Draft Button

## Problem

After loading all 516 NBA players into the draft pool, two issues appeared:

1. **Slow Firestore writes** — 516 individual `setDoc` calls (in `handleSchedule`) + another 516 + 120+ picks (in `handleStartDraft`) make the app hang.
2. **"Start Draft Now" button does nothing** — No loading state, and `handleStartDraft` re-generates all 516 players even though they already exist from `handleSchedule`.

## Changes

### 1. Import `writeBatch` from Firestore

**File:** `frontend/src/pages/LeagueDraft.jsx:3`

Add `writeBatch` to the Firestore import:
```js
import { doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, orderBy, limit, deleteDoc, collection, writeBatch } from 'firebase/firestore';
```

### 2. Add `isStarting` state variable

**File:** `frontend/src/pages/LeagueDraft.jsx:~89`

```js
const [isStarting, setIsStarting] = useState(false);
```

### 3. Use batched writes in `handleSchedule`

**File:** `frontend/src/pages/LeagueDraft.jsx:300-305`

Replace the individual `setDoc` loop with batched writes (max 500 per batch):

```js
try {
  const count = totalRounds > 3 ? getPoolSize() : totalPicks;
  const players = await generateAvailablePlayers(count);
  let batch = writeBatch(db);
  let opCount = 0;
  for (const p of players) {
    const ref = doc(collection(db, 'leagues', id, 'drafts', dId, 'players'), p.id || p.firestoreId || uid());
    batch.set(ref, p);
    opCount++;
    if (opCount >= 500) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();
} catch (e) { console.error('generate pool:', e); }
```

### 4. Skip player regeneration in `handleStartDraft`

**File:** `frontend/src/pages/LeagueDraft.jsx:~337-350`

After setting picks, check if players already exist and skip regeneration:

```js
setPicks(localPicks);

// Players already saved in handleSchedule — only generate if pool is empty
const pSnap = await getDocs(collection(db, 'leagues', id, 'drafts', dId, 'players'));
if (pSnap.empty) {
  const count = totalRounds > 3 ? getPoolSize() : totalPicks;
  const players = await generateAvailablePlayers(count);
  let batch = writeBatch(db);
  let opCount = 0;
  for (const p of players) {
    const ref = doc(collection(db, 'leagues', id, 'drafts', dId, 'players'), p.id);
    batch.set(ref, p);
    opCount++;
    if (opCount >= 500) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  }
  if (opCount > 0) await batch.commit();
}
```

### 5. Use batched writes for picks

**File:** `frontend/src/pages/LeagueDraft.jsx:~337-342`

Replace individual `setDoc` for picks with batched writes:

```js
const localPicks = [];
let pickBatch = writeBatch(db);
let pickCount = 0;
for (const p of batch) {
  const pId = uid();
  pickBatch.set(draftPickDoc(id, dId, pId), p);
  localPicks.push({ id: pId, ...p });
  pickCount++;
  if (pickCount >= 500) { await pickBatch.commit(); pickBatch = writeBatch(db); pickCount = 0; }
}
if (pickCount > 0) await pickBatch.commit();
```

### 6. Add loading state to button & disable during start

**File:** `frontend/src/pages/LeagueDraft.jsx:~581-583`

```jsx
{isCommissioner && (
  <button
    onClick={handleStartDraft}
    disabled={isStarting}
    className={`px-8 py-2.5 text-sm ${isStarting ? 'btn-disabled opacity-50 cursor-not-allowed' : 'btn-glow'}`}
  >
    {isStarting ? 'Starting Draft...' : 'Start Draft Now'}
  </button>
)}
```

Also wrap the body of `handleStartDraft` with:
```js
const handleStartDraft = async () => {
  if (!draft || isStarting) return;
  setIsStarting(true);
  try {
    // ... existing logic ...
  } finally {
    setIsStarting(false);
  }
};
```

### 7. Show loading state for player count

**File:** `frontend/src/pages/LeagueDraft.jsx:~578`

Replace with:
```jsx
<p>• {draft?.poolLoading ? 'Loading...' : `${undraftedPlayers.length} players in the pool`}</p>
```

Or simpler — just show the count with context (it will update live via the Firestore subscription once data finishes writing).

## Verification

1. Schedule a draft with a fresh league — player pool should load to 516 players quickly
2. Press "Start Draft Now" — button should show "Starting Draft..." and picks should appear
3. No "0 players" flash
