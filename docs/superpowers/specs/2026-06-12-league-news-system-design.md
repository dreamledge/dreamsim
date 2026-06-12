# League News System Design

## Overview

A per-league news generation system for the basketball sim that produces rich, newspaper-style content in 6-item cycles. Content is generated client-side (in the browser) on a 3-hour cadence and stored in Firestore per-league news subcollections.

## Architecture

```
User visits league news page
  → Check leagueNewsMeta.lastGeneratedAt
  → If > 3 hours ago OR no content exists:
    → newsEngine.generateCycle(leagueId)
      → Read: teams, standings, games, prev cycles
      → Generate 6 items (templates + league data)
      → Batch write to leagueNewsCol
      → Update leagueNewsMeta
  → Display all items newest-first via NewsFeed
```

## Files

| File | Role |
|------|------|
| `src/engine/newsEngine.js` | Content generator — 6 producers + orchestration |
| `src/pages/NewsFeed.jsx` | Newspaper-style display (existing, heavily extended) |
| `src/pages/LeagueNews.jsx` | League selector accordion (existing, minor updates) |

## Firestore Schema

### News items — `leagues/{leagueId}/news/{newsId}`

```
{
  type: "news" | "rumor" | "satire" | "podcast" | "social" | "locker_room",
  title: string,
  subheadline: string,
  publication: string,    // "League Wire" | "Hardwood Insider" | "The Daily Dunk" | "Front Office Report" | "Courtside Chaos" | "The Basketball Chronicle"
  body: string,
  createdAt: timestamp,
  cycle: number,
  isSatire: boolean,
  relatedTeams: string[],
  relatedPlayers: string[],
  relatedUsers: string[],
  metadata: {
    homeTeam?: string, awayTeam?: string,
    homeScore?: number, awayScore?: number,
    week?: number,
    stats?: { team: string, label: string, value: string }[],
  },
}
```

### Meta — `leagues/{leagueId}/news_meta`

```
{
  lastCycle: number,
  lastGeneratedAt: timestamp,
  activeStorylines: {
    rivalry: [{ teamA, teamB, intensity }],
    mvpRace: [{ playerName, teamName, statLine }],
    tradeFallout: [{ playerName, fromTeam, toTeam, reaction }],
    coachingPressure: [{ coachName, teamName, hotSeatLevel }],
    playerArcs: [{ playerName, teamName, arc }],
    lockerRoomIssues: [{ teamName, description }],
  },
}
```

## Content Generator — 6 Items Per Cycle

### 1. Major News (`type: "news"`)
- Picks most significant game (biggest upset, closest score, highest combined score)
- 3-5 paragraph recap with box score, key player quote, standings context
- Publications: League Wire, The Basketball Chronicle, The Daily Dunk

### 2. Rumor / Insider (`type: "rumor"`)
- Trade speculation referencing actual roster needs (worst position group, expiring contracts)
- 2-4 paragraphs with "sources say" framing
- Publications: Hardwood Insider, Front Office Report

### 3. Satire (`type: "satire"`)
- Exaggerates a real league trend (e.g., "Coach claims 5-out offense is unbeatable")
- 2-3 paragraphs, fictional but grounded in league reality
- Publication: Courtside Chaos (satire only)

### 4. Podcast (`type: "podcast"`)
- Transcript dialogue: Host + Analyst
- Debates the major news topic + adds hot takes
- 4-8 exchanges with Host/Analyst labels

### 5. Social Media Posts (2 items, `type: "social"`)
- Short post from player, fan, or analyst reacting to recent events
- 1-2 lines, includes username handle

### 6. Locker Room (`type: "locker_room"`)
- Behind-the-scenes dialogue from a team that just played
- 3-6 lines of dialogue with speaker attribution

## Template System

Each type has 15-30 templates with dynamic slots:

- `{team}` — team name
- `{abbr}` — team abbreviation
- `{score}` — game score
- `{opponent}` — opponent name
- `{player}` — top performer name
- `{stat}` — stat value (points, rebounds, etc.)
- `{week}` — current week
- `{record}` — team's win-loss record

Slots are populated from actual league data at generation time. Templates rotate to avoid repetition.

## Continuity System

`activeStorylines` in `news_meta` persists across cycles:

- Each cycle reads previous storylines, advances them, and writes back
- Example: A rivalry started in cycle 1 gets referenced in cycles 2 and 3
- Storylines decay if not reinforced (intensity drops each cycle without new fuel)
- New storylines start when events warrant (blowout game → rivalry, hot streak → MVP talk)

## Frontend Display

- **NewsFeed.jsx** renders each type with distinct treatment:
  - News/Rumor/Satire: Full article card with headline, publication badge, body, stats
  - Podcast: Transcript dialogue with Host/Analyst labels
  - Social: Compact card with "username" and short text
  - Locker Room: Italic dialogue with scene heading
- Grouped by cycle with "Cycle X" headers
- Newest cycles first
- Each item visually styled like a newspaper article
- Serif fonts for headlines, column-like body text

## Data Sources Per Cycle

The generator reads from Firestore:

1. `teams` collection filtered by `leagueId` (names, records, colors, userId)
2. Current season's games collection (all games, sorted by week)
3. Previous 3 cycles of news (for continuity references)
4. `news_meta` active storylines

## Implementation Order

1. Create `src/engine/newsEngine.js` — 6 generators + orchestrator
2. Extend `NewsFeed.jsx` — newspaper-style rendering per type
3. Add generation trigger to `NewsFeed.jsx` — timestamp check + auto-generate
4. Update `LeagueNews.jsx` — use same display for expanded news sections
