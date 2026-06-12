# Free Agents System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Free Agents browsing page, remove auto-assign on team creation, and add commissioner offseason controls.

**Architecture:** Three files modified (CreateTeam, LeagueDetail, App) and one new page (FreeAgents). Free agents data sourced from NBA player pool JSON, filtered against current team rosters in Firestore.

**Tech Stack:** React, Firebase Firestore, Vite, NBA player pool JSON

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/CreateTeam.jsx` | Modify | Remove auto-draft on team creation |
| `frontend/src/pages/LeagueDetail.jsx` | Modify | Add Free Agents button, add offseason controls |
| `frontend/src/pages/FreeAgents.jsx` | Create | New page: browse available players with search/filter |
| `frontend/src/App.jsx` | Modify | Add route for FreeAgents |

---

### Task 1: Remove Auto-Draft from CreateTeam

**Files:**
- Modify: `frontend/src/pages/CreateTeam.jsx`

- [ ] **Step 1: Remove auto-draft logic and clean up unused state** — In `CreateTeam.jsx`:
  1. Delete the `initializing` state declaration (line 34: `const [initializing, setInitializing] = useState(false);`)
  2. Delete the `ensureNbaPool()` and `draftNbaPlayers(5)` call and the `for` loop block that saves players (lines 68-77)
  3. Update the button text (line 135): change `{loading ? 'Loading NBA players...' : 'Create Team & Draft Players'}` to `{loading ? 'Creating...' : 'Create Team'}`
  4. Update the button disabled attribute (line 134): change `disabled={loading || initializing}` to `disabled={loading}`
  5. Remove unused import (line 7): change `import { draftNbaPlayers, ensureNbaPool } from '../engine/gameEngine';` to just remove the line entirely

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CreateTeam.jsx
git commit -m "fix: remove auto-draft on team creation, team starts empty"
```

---

### Task 2: Add Free Agents Button to LeagueDetail

**Files:**
- Modify: `frontend/src/pages/LeagueDetail.jsx`

- [ ] **Step 1: Add Free Agents to the quick actions grid** — Insert a new entry in the actions array (line 360), before Standings:

```jsx
{ label: 'Free Agents', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>, to: `/leagues/${id}/freeagents` },
```

Change the grid container (line 358) from `grid-cols-5` to `grid-cols-6`:
```jsx
<div className="grid grid-cols-6 gap-2 animate-fade-up">
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/LeagueDetail.jsx
git commit -m "feat: add Free Agents button to league detail quick actions"
```

---

### Task 3: Create FreeAgents Page

**Files:**
- Create: `frontend/src/pages/FreeAgents.jsx`

- [ ] **Step 1: Write the full FreeAgents component**

```jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, getDocs, query, where, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { leagueDoc, teamsCol, teamPlayersCol } from '../lib/firestore';
import NBA_PLAYER_POOL from '../engine/nbaPlayerPool.json';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];

export default function FreeAgents() {
  const { id } = useParams();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [ovrMin, setOvrMin] = useState(0);
  const [ovrMax, setOvrMax] = useState(99);
  const [userTeam, setUserTeam] = useState(null);
  const [signingStatus, setSigningStatus] = useState({ enabled: false, message: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const lSnap = await getDoc(leagueDoc(id));
        if (!lSnap.exists()) { setLoading(false); return; }
        const lData = { id: lSnap.id, ...lSnap.data() };
        setLeague(lData);

        const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
        const teams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUserTeam(teams.find(t => t.userId === user?.id) || null);

        const takenIds = new Set();
        for (const team of teams) {
          try {
            const pSnap = await getDocs(teamPlayersCol(team.id));
            pSnap.docs.forEach(d => {
              if (d.data().playerId) takenIds.add(d.data().playerId);
            });
          } catch (e) {}
        }

        const pool = NBA_PLAYER_POOL.players || [];
        setAvailable(pool.filter(p => !takenIds.has(p.playerId)));

        try {
          const sSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', id), orderBy('seasonNumber', 'desc'), limit(1)));
          if (!sSnap.empty) {
            const season = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
            const dSnap = await getDocs(query(collection(db, 'leagues', id, 'drafts'), where('status', '==', 'completed')));
            const hasCompletedDraft = !dSnap.empty;

            if (!hasCompletedDraft) {
              setSigningStatus({ enabled: false, message: 'Free agency opens after the first draft.' });
            } else if (lData.offseason === true) {
              setSigningStatus({ enabled: true, message: 'Offseason — free agency is open.' });
            } else if (season.status === 'regular' && season.currentWeek <= season.totalWeeks / 2) {
              setSigningStatus({ enabled: true, message: 'First half of season — free agency is open.' });
            } else if (season.status === 'regular') {
              setSigningStatus({ enabled: false, message: 'Free agency closes during the second half of the season.' });
            } else if (season.status === 'pregame') {
              setSigningStatus({ enabled: false, message: 'Free agency opens after the first draft.' });
            } else {
              setSigningStatus({ enabled: false, message: 'Free agency is currently closed.' });
            }
          }
        } catch (e) {}
      } catch (e) {
        console.error('FreeAgents load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  const filtered = available.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchName = !search || fullName.includes(search.toLowerCase());
    const matchPos = positionFilter === 'All' || p.primaryPosition === positionFilter;
    const matchOvr = (p.overall || 50) >= ovrMin && (p.overall || 50) <= ovrMax;
    return matchName && matchPos && matchOvr;
  });

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display text-3xl tracking-wider">Free Agents</h2>
          <p className="text-sm text-[var(--text-secondary)]">{available.length} players available</p>
        </div>
        {userTeam && (
          <Link to={`/teams/${userTeam.id}`} className="btn-ghost px-3 py-1.5 text-xs">My Team</Link>
        )}
      </div>

      <div className={`rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-up ${
        signingStatus.enabled
          ? 'bg-green-500/10 border border-green-500/20 text-green-400'
          : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]'
      }`}>
        {signingStatus.enabled ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        )}
        <span>{signingStatus.message}</span>
      </div>

      <div className="glass-card p-4 space-y-3 animate-fade-up">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by player name..."
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all placeholder:text-[var(--text-tertiary)]"
        />
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setPositionFilter(pos)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all duration-200 ${
                positionFilter === pos
                  ? 'bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-white shadow-md'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}>
              {pos}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-tertiary)] shrink-0 w-16">OVR: {ovrMin}-{ovrMax}</span>
          <input type="range" min={0} max={99} value={ovrMin}
            onChange={e => setOvrMin(Math.min(Number(e.target.value), ovrMax - 5))}
            className="flex-1 accent-[var(--accent-orange)] h-1.5" />
          <input type="range" min={0} max={99} value={ovrMax}
            onChange={e => setOvrMax(Math.max(Number(e.target.value), ovrMin + 5))}
            className="flex-1 accent-[var(--accent-orange)] h-1.5" />
        </div>
      </div>

      <div className="space-y-1 animate-slide-up">
        <p className="text-xs text-[var(--text-tertiary)] font-medium mb-2">{filtered.length} players match filters</p>
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {filtered.sort((a, b) => (b.overall || 0) - (a.overall || 0)).map((p, i) => (
            <div key={p.playerId} className="glass-card p-3 flex items-center gap-3 transition-all duration-200 hover:bg-[var(--bg-tertiary)]" style={{animationDelay: `${i * 0.02}s`}}>
              <div className="rating-circle rating-circle-sm shrink-0" style={{'--pct': `${p.overall || 50}%`}}>
                <span className="text-white text-xs">{p.overall || '-'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--text-tertiary)]">
                  <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.primaryPosition || p.position}</span>
                  <span>{p.age} yrs</span>
                  <span>{p.height}"</span>
                </div>
                <div className="flex gap-2 mt-1 text-[10px] text-[var(--text-secondary)]">
                  <span>OFF {p.offense || '-'}</span>
                  <span>DEF {p.defense || '-'}</span>
                  <span>SHO {p.shooting || '-'}</span>
                  <span>PLAY {p.playmaking || '-'}</span>
                  <span>REB {p.rebounding || '-'}</span>
                  <span>ATH {p.athleticism || '-'}</span>
                </div>
              </div>
              <div className="text-right text-xs text-[var(--text-tertiary)] shrink-0">
                <p className="font-medium text-[var(--text-secondary)]">{p.statsPpg != null ? Number(p.statsPpg).toFixed(1) : p.ppg != null ? Number(p.ppg).toFixed(1) : '-'} PPG</p>
                <p>{p.statsRpg != null ? Number(p.statsRpg).toFixed(1) : p.rpg != null ? Number(p.rpg).toFixed(1) : '-'} RPG</p>
                <p>{p.statsApg != null ? Number(p.statsApg).toFixed(1) : p.apg != null ? Number(p.apg).toFixed(1) : '-'} APG</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No players match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/FreeAgents.jsx
git commit -m "feat: add Free Agents page with search/filter"
```

---

### Task 4: Add Route to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import and add route** — Add import at line 21:
```jsx
import FreeAgents from './pages/FreeAgents';
```

Add route after the League Detail route (after line 39):
```jsx
<Route path="/leagues/:id/freeagents" element={<ProtectedRoute><Layout><FreeAgents /></Layout></ProtectedRoute>} />
```

Full context (lines 39-40 should become):
```jsx
        <Route path="/leagues/:id" element={<ProtectedRoute><Layout><LeagueDetail /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id/freeagents" element={<ProtectedRoute><Layout><FreeAgents /></Layout></ProtectedRoute>} />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add free agents route"
```

---

### Task 5: Add Commissioner Offseason Controls to LeagueDetail

**Files:**
- Modify: `frontend/src/pages/LeagueDetail.jsx`

- [ ] **Step 1: Add offseason buttons** — After the Sim Controls section (after line 383), add the offseason controls that only the commissioner sees:

```jsx
      {/* ── Offseason Controls ── */}
      {isCommissioner && season?.status === 'completed' && !league?.offseason && (
        <button onClick={handleStartOffseason} className="btn-glow w-full py-2.5 text-sm">
          Start Offseason
        </button>
      )}
      {isCommissioner && league?.offseason === true && (
        <button onClick={handleEndOffseason} className="btn-glow w-full py-2.5 text-sm">
          End Offseason
        </button>
      )}
```

- [ ] **Step 2: Add handler functions** — After the `simAll` function (after line 183), add two new handlers:

```jsx
  const handleStartOffseason = async () => {
    if (!league) return;
    try {
      await updateDoc(leagueDoc(id), { offseason: true });
      setLeague(prev => ({ ...prev, offseason: true }));
    } catch (e) {
      console.error('Start offseason error:', e);
    }
  };

  const handleEndOffseason = async () => {
    if (!league) return;
    try {
      const newSeasonId = uid();
      const nextNumber = (league.currentSeason || 1) + 1;
      await setDoc(doc(db, 'seasons', newSeasonId), {
        leagueId: id, seasonNumber: nextNumber,
        status: 'pregame', currentWeek: 0, totalWeeks: 24,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(leagueDoc(id), { currentSeason: nextNumber, offseason: false });
      setLeague(prev => ({ ...prev, currentSeason: nextNumber, offseason: false }));
      load();
    } catch (e) {
      console.error('End offseason error:', e);
    }
  };
```

- [ ] **Step 3: Update imports** — Ensure `setDoc` and `collection` are imported at line 3. Currently line 3 reads:
```jsx
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, updateDoc, setDoc } from 'firebase/firestore';
```
This already includes `setDoc`, `updateDoc`, `doc`, `collection`. No import changes needed.

- [ ] **Step 4: Ensure `uid` is imported** — Check line 6:
```jsx
import { uid, leagueDoc, teamsCol, teamPlayersCol, seasonDoc, seasonGamesCol, leagueNewsCol, championshipsCol, championshipDoc, leagueNewsDoc } from '../lib/firestore';
```
This already includes `uid`. Good.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LeagueDetail.jsx
git commit -m "feat: add commissioner offseason start/end controls"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Task 1 covers "Remove auto-assign" — the main reason players appear on teams. Task 2 covers "Free Agents button under My Team". Task 3 covers "scroll through available players, search by position/overalls/names". Task 5 covers "commissioner controls start/end offseason". All spec requirements covered.

- [ ] **Placeholder scan:** No TBDs, TODOs, or vague steps. Every code block contains complete, working code.

- [ ] **Type consistency:** `playerId` used consistently as pool identifier. `league.offseason` boolean used in both FreeAgents.jsx and LeagueDetail.jsx. `getDocs`, `query`, `where` usage matches existing codebase patterns.
