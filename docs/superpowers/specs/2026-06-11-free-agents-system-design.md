# Free Agents System & Player Pool Design

## Problem
1. Creating a team auto-assigns 5 NBA players to the roster before any draft occurs
2. No way to browse available (undrafted) players in the league
3. No offseason lifecycle management (commissioner cannot start/end offseason)

## Scope
View-only free agent browsing, auto-assign removal, and commissioner offseason controls. Signing mechanic deferred to future iteration.

---

## 1. Remove Auto-Assign on Team Creation

**File: `frontend/src/pages/CreateTeam.jsx`**

- Remove lines 68-77 (the `draftNbaPlayers(5)` call and subsequent `setDoc` loops that assign players to `teamPlayersCol`)
- Button text changes from "Create Team & Draft Players" to "Create Team"
- Team is created with an empty roster — players only come via the manual live draft

## 2. Free Agents Button — League Detail

**File: `frontend/src/pages/LeagueDetail.jsx`**

- Add a "Free Agents" quick action to the 5-button grid (push it to 6 buttons, or replace the `Trades` slot since Trades has its own nav, or put FA as a 6th button)
- Icon: a magnifying glass / user-search icon
- Route: `/leagues/${id}/freeagents`

## 3. Free Agents Page (View-Only)

**File: `frontend/src/pages/FreeAgents.jsx`** (new)
**Route: `/leagues/:id/freeagents`**

### Data Source
- NBA player pool JSON (`nbaPlayerPool.json`, ~516 players) loaded via existing `getNbaPlayerPool()` or direct import
- All team rosters in this league loaded via Firestore (`teamPlayersCol` for each team)

### Filtering
- A player is "available" if their `firstName`/`lastName` combination does NOT appear on any team's roster in this league
- After the first draft, remaining undrafted players show here

### UI Layout
- **Header:** "Free Agents" with count of available players
- **Search bar:** Text input filtering by `firstName` + `lastName`
- **Filter row:** Position buttons (All, PG, SG, SF, PF, C) + OVR range slider
- **Player list:** Vertical scrollable list of player cards, sorted by OVR descending

### Player Card
- OVR rating circle (reuses existing `.rating-circle` styles)
- Name, position badge, age, height
- 6 compact attribute labels: OFF / DEF / SHO / PLAY / REB / ATH (numeric values)
- Season stats: PPG / RPG / APG
- "Drafted" indicator (subtle) if already taken

### Signing Rules (UI Only — No Action)
- **Before first draft:** Banner "Free agency opens after the first draft"
- **Second half of season:** Banner "Free agency closed — resumes in offseason"
- **First half or offseason:** Player cards shown normally

## 4. Commissioner Offseason Controls

**File: `frontend/src/pages/LeagueDetail.jsx`**

### Start Offseason
- Appears when `season.status === 'completed'` AND `league.offseason !== true`
- Button: "Start Offseason" positioned under the Schedule button
- On click: sets `league.offseason = true` on the league doc
- This is the signal for free agency being open

### End Offseason
- Appears when `league.offseason === true`
- Button: "End Offseason" 
- On click: creates a new season doc (`status: 'pregame'`, `currentWeek: 0`, `seasonNumber: previous + 1`), sets `league.currentSeason` to new number, sets `league.offseason = false`

## 5. Route Registration

**File: `frontend/src/App.jsx`**

Add route:
```jsx
<Route path="/leagues/:id/freeagents" element={<ProtectedRoute><Layout><FreeAgents /></Layout></ProtectedRoute>} />
```

Import:
```jsx
import FreeAgents from './pages/FreeAgents';
```

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/CreateTeam.jsx` | Remove auto-draft (lines 68-77), update button text |
| `frontend/src/pages/LeagueDetail.jsx` | Add Free Agents button, add offseason controls |
| `frontend/src/pages/FreeAgents.jsx` | New file — FA browser with search/filter |
| `frontend/src/App.jsx` | Add `/leagues/:id/freeagents` route |

## Future Work (Not in Scope)
- Free agent signing mechanic (offers → 24h evaluation → signing)
- Player cut/release from roster
- Contract management
