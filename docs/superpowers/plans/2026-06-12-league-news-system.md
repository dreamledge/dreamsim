# League News System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and display rich per-league news content in 6-item cycles with newspaper-style UI.

**Architecture:** Client-side generator (`newsEngine.js`) reads league data from Firestore, fills template pools, writes 6 items per cycle to `leagueNewsCol`. Frontend (`NewsFeed.jsx`, `LeagueNews.jsx`) checks generation timestamp and renders with type-specific styling.

**Tech Stack:** React, Firestore, CSS newspaper-style

---

### Task 1: Create newsEngine.js — Generator Core

**Files:**
- Create: `frontend/src/engine/newsEngine.js`

- [ ] **Step 1: Create the engine skeleton with data fetchers**

```javascript
import { getDocs, query, where, orderBy, limit, collection, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { uid, leagueDoc, teamsCol, seasonGamesCol, leagueNewsCol, leagueDoc } from '../lib/firestore';

const PUBLICATIONS = {
  news: ['League Wire', 'The Basketball Chronicle', 'The Daily Dunk'],
  rumor: ['Hardwood Insider', 'Front Office Report'],
  satire: ['Courtside Chaos'],
  podcast: ['Hardwood Hot Takes'],
  social: ['Twitter/X', 'Instagram'],
  locker_room: ['The Athletic'],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatRecord(wins, losses) {
  return `${wins || 0}-${losses || 0}`;
}
```

- [ ] **Step 2: Implement data loading from Firestore**

```javascript
async function loadLeagueData(leagueId) {
  const [leagueSnap, teamSnap, metaSnap] = await Promise.all([
    getDoc(leagueDoc(leagueId)),
    getDocs(query(teamsCol(), where('leagueId', '==', leagueId))),
    getDoc(doc(db, 'leagues', leagueId, 'news_meta', 'state')),
  ]);
  if (!leagueSnap.exists()) return null;

  const league = { id: leagueSnap.id, ...leagueSnap.data() };
  const teams = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const meta = metaSnap.exists() ? metaSnap.data() : null;

  let season = null;
  let games = [];
  try {
    const sSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', leagueId)));
    const seasonsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
    if (seasonsList.length > 0) {
      season = seasonsList[0];
      const gSnap = await getDocs(seasonGamesCol(season.id));
      games = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {}

  return { league, teams, season, games, meta };
}
```

- [ ] **Step 3: Implement computeStats helper (team performance, streaks, top players)**

```javascript
function computeStats(teams, games) {
  const teamStats = {};
  for (const t of teams) {
    const teamGames = games.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
    const completed = teamGames.filter(g => g.isCompleted === 1);
    const wins = completed.filter(g => (g.homeTeamId === t.id && g.homeScore > g.awayScore) || (g.awayTeamId === t.id && g.awayScore > g.homeScore)).length;
    const losses = completed.length - wins;
    const streak = computeStreak(completed, t.id);
    const homeGames = completed.filter(g => g.homeTeamId === t.id);
    const awayGames = completed.filter(g => g.awayTeamId === t.id);
    const homeWins = homeGames.filter(g => g.homeScore > g.awayScore).length;
    const awayWins = awayGames.filter(g => g.awayScore > g.homeScore).length;
    const ppg = completed.length > 0 ? Math.round(completed.reduce((s, g) => s + (g.homeTeamId === t.id ? g.homeScore : g.awayScore), 0) / completed.length) : 0;
    const oppg = completed.length > 0 ? Math.round(completed.reduce((s, g) => s + (g.homeTeamId === t.id ? g.awayScore : g.homeScore), 0) / completed.length) : 0;
    teamStats[t.id] = { wins, losses, streak, homeWins, awayWins, ppg, oppg, gp: completed.length };
  }
  return teamStats;

  function computeStreak(completedGames, teamId) {
    const sorted = [...completedGames].sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0));
    let streak = 0;
    for (const g of sorted) {
      const won = (g.homeTeamId === teamId && g.homeScore > g.awayScore) || (g.awayTeamId === teamId && g.awayScore > g.homeScore);
      if (streak === 0) { streak = won ? 1 : -1; continue; }
      if ((streak > 0 && won) || (streak < 0 && !won)) { streak += won ? 1 : -1; }
      else break;
    }
    return streak;
  }
}

function getTopPlayer(players) {
  if (!players || players.length === 0) return null;
  return [...players].sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
}

function getUserTeams(teams) {
  return teams.filter(t => t.userId && t.userId !== 'ai');
}

function getAiTeams(teams) {
  return teams.filter(t => !t.userId || t.userId === 'ai');
}
```

- [ ] **Step 4: Implement Major News generator (picks best game, writes recap)**

```javascript
function generateMajorNews(teams, games, teamStats, season, cycle) {
  const completed = games.filter(g => g.isCompleted === 1);
  if (completed.length === 0) return null;

  const scored = completed.map(g => {
    const home = teams.find(t => t.id === g.homeTeamId);
    const away = teams.find(t => t.id === g.awayTeamId);
    const homeStat = teamStats[g.homeTeamId];
    const awayStat = teamStats[g.awayTeamId];
    const spread = Math.abs(g.homeScore - g.awayScore);
    const total = g.homeScore + g.awayScore;
    const upset = homeStat && awayStat && ((homeStat.wins < awayStat.wins && g.homeScore > g.awayScore) || (awayStat.wins < homeStat.wins && g.awayScore > g.homeScore));
    let score = spread < 5 ? 100 : total > 220 ? 80 : 60;
    if (upset) score += 40;
    return { game: g, home, away, homeStat, awayStat, spread, upset, total, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best.home || !best.away) return null;

  const homeWon = best.game.homeScore > best.game.awayScore;
  const winner = homeWon ? best.home : best.away;
  const loser = homeWon ? best.away : best.home;
  const homeTeamPlayers = best.home.players || [];
  const awayTeamPlayers = best.away.players || [];
  const topScorer = getTopPlayer([...homeTeamPlayers, ...awayTeamPlayers]);
  const winnerStat = homeWon ? best.homeStat : best.awayStat;
  const loserStat = homeWon ? best.awayStat : best.homeStat;

  let headline;
  if (best.upset) {
    headline = `${winner.name} STUNS ${loser.name} IN ${best.game.homeScore}-${best.game.awayScore} THRILLER`;
  } else if (best.spread < 5) {
    headline = `${winner.name} EDGES ${loser.name} ${best.game.homeScore}-${best.game.awayScore} IN NAIL-BITER`;
  } else {
    headline = `${winner.name} DOMINATES ${loser.name} ${best.game.homeScore}-${best.game.awayScore}`;
  }

  const templates = [
    `In a game that had fans on the edge of their seats, the ${winner.name} (${formatRecord(winnerStat?.wins || 0, winnerStat?.losses || 0)}) defeated the ${loser.name} (${formatRecord(loserStat?.wins || 0, loserStat?.losses || 0)}) by a final score of ${best.game.homeScore}-${best.game.awayScore}. The victory improves ${winner.name}'s record to ${formatRecord(winnerStat?.wins || 0, winnerStat?.losses || 0)}, while ${loser.name} falls to ${formatRecord(loserStat?.wins || 0, loserStat?.losses || 0)}.\n\nThe game was a showcase of high-level basketball, with both teams trading leads throughout. ${winner.name} ultimately pulled away behind strong play from their key contributors.\n\n"Give credit to ${loser.name}, they fought hard," said a ${winner.name} spokesperson after the game. "But we stuck to our game plan and executed when it mattered most."`,
    `Week ${season?.currentWeek || '?'} of the season brought us a matchup between the ${winner.name} and the ${loser.name}, and it did not disappoint. When the dust settled, ${winner.name} walked away with a ${best.game.homeScore}-${best.game.awayScore} victory.\n\nThe ${winner.name} have now won ${winnerStat?.streak > 0 ? `${winnerStat.streak} straight` : 'a crucial bounce-back game'}, while ${loser.name} will look to regroup after ${loserStat?.streak < 0 ? `their ${Math.abs(loserStat.streak)}-game slide` : 'the loss'}.\n\n${topScorer ? `${topScorer.firstName} ${topScorer.lastName} led the charge with another impressive performance this season.` : 'The team effort was evident across the board.'}`,
  ];

  const body = pick(templates);
  const publication = pick(PUBLICATIONS.news);

  return {
    type: 'news',
    title: headline,
    subheadline: `${winner.name} improves to ${formatRecord(winnerStat?.wins || 0, winnerStat?.losses || 0)} with ${best.game.homeScore}-${best.game.awayScore} win over ${loser.name}`,
    publication,
    body,
    cycle,
    isSatire: false,
    relatedTeams: [best.game.homeTeamId, best.game.awayTeamId],
    relatedPlayers: topScorer ? [`${topScorer.firstName} ${topScorer.lastName}`] : [],
    relatedUsers: [],
    metadata: {
      homeTeam: best.home.name, awayTeam: best.away.name,
      homeScore: best.game.homeScore, awayScore: best.game.awayScore,
      week: best.game.week,
      stats: [
        { team: winner.name, label: 'Streak', value: winnerStat?.streak > 0 ? `W${winnerStat.streak}` : `L${Math.abs(winnerStat?.streak || 0)}` },
        { team: loser.name, label: 'Streak', value: loserStat?.streak > 0 ? `W${loserStat.streak}` : `L${Math.abs(loserStat?.streak || 0)}` },
      ],
    },
  };
}
```

- [ ] **Step 5: Implement Rumor generator**

```javascript
function generateRumor(teams, games, teamStats, cycle) {
  const withStats = teams.filter(t => teamStats[t.id] && teamStats[t.id].gp > 0);
  if (withStats.length < 2) {
    const target = pick(teams);
    if (!target) return null;
    return {
      type: 'rumor', title: `TRADE WINDS: ${target.name} Exploring Moves`,
      subheadline: `Sources indicate ${target.name} is looking to shake up the roster`,
      publication: pick(PUBLICATIONS.rumor),
      body: `According to league sources, the ${target.name} are actively exploring trade options as they look to retool their roster. Front office executives have been making calls around the league, gauging interest in potential deals.\n\nThe team's management declined to comment, but insiders suggest they're looking for upgrades at multiple positions.\n\n"Teams are always looking to improve," one league executive said. "The ${target.name} have some interesting pieces that could be attractive to contenders."`,
      cycle, isSatire: false,
      relatedTeams: [target.id], relatedPlayers: [], relatedUsers: [],
      metadata: {},
    };
  }

  const sorted = [...withStats].sort((a, b) => (teamStats[a.id]?.wins || 0) - (teamStats[b.id]?.wins || 0));
  const struggling = sorted.slice(0, 2);
  const contender = sorted.slice(-1)[0];

  const tradable = [pick(struggling), contender].filter(Boolean);
  const seller = tradable[0];
  const buyer = tradable[1];

  const templates = [
    `Rumors are swirling around the league as the ${seller.name} reportedly field calls about potential trades. With a record of ${formatRecord(teamStats[seller.id]?.wins || 0, teamStats[seller.id]?.losses || 0)}, the team may be looking to make moves for the future.\n\nMeanwhile, the ${buyer.name} are said to be sniffing around, looking to add pieces for a playoff push. League insiders suggest conversations have been preliminary but could heat up in the coming weeks.\n\n"Nothing is imminent, but teams are doing their due diligence," a league source told ${pick(PUBLICATIONS.rumor)}.`,
    `The trade market is heating up, and the ${seller.name} appear to be at the center of it. Multiple teams have checked in on available assets, with the ${buyer.name} among the most aggressive suitors.\n\nFront office sources indicate that discussions have moved beyond the exploratory phase, though no deal is close to being finalized.\n\n"These talks tend to move fast once they start," an NBA insider reported. "Don't be surprised if something happens before the next cycle."`,
  ];

  return {
    type: 'rumor',
    title: `TRADE RUMORS: ${seller.name} - ${buyer.name} Talks Heating Up`,
    subheadline: `League sources confirm the ${seller.name} and ${buyer.name} have had discussions`,
    publication: pick(PUBLICATIONS.rumor),
    body: pick(templates),
    cycle, isSatire: false,
    relatedTeams: [seller.id, buyer.id], relatedPlayers: [], relatedUsers: [],
    metadata: {},
  };
}
```

- [ ] **Step 6: Implement Satire generator**

```javascript
function generateSatire(teams, teamStats, cycle) {
  const target = pick(teams);
  if (!target) return null;
  const stat = target.id ? teamStats[target.id] : null;
  const record = stat ? formatRecord(stat.wins, stat.losses) : '0-0';

  const templates = [
    {
      title: `BREAKING: ${target.name} ${target.abbreviation || ''} Coach Introduces Revolutionary "Score More Points" Strategy`,
      body: `In a press conference that left analytics departments scrambling, ${target.name} head coach unveiled what he calls "the most innovative offensive scheme since the invention of dribbling."\n\nThe strategy, simply described as "score more points than the other team," has apparently been in development for weeks.\n\n"People overthink this game," the coach explained. "I watched film from 1950 and noticed something — the team with more points always wins. We've been chasing ghosts with all these advanced metrics."\n\nWhen asked about defensive adjustments, the coach replied, "We're also exploring the radical concept of 'don't let them score.' Early results are mixed."\n\nThe team currently sits at ${record}.`,
    },
    {
      title: `EXCLUSIVE: ${target.name} Mascot Demands Trade to Contender`,
      body: `In a development that has sent shockwaves through the league, the ${target.name} mascot has reportedly requested a trade to a championship contender.\n\nSources say the mascot is "frustrated with the direction of the franchise" and wants to "perform for a winning crowd for once."\n\n"It's about legacy," the mascot's agent said in a statement. "My client has 47 years of experience entertaining crowds. At this stage of his career, he deserves a shot at a title."\n\nThe team has not commented, but insiders suggest they're seeking at least two dance team members and a foam finger in return.`,
    },
    {
      title: `REPORT: League Considering Moving Three-Point Line to Half Court`,
      body: `In what sources describe as "the only logical next step for basketball evolution," league officials are reportedly considering a radical change — moving the three-point line to half court.\n\n"The analytics support it," one league official, who wished to remain anonymous, told ${pick(PUBLICATIONS.satire)}. "Players are shooting 38% from 40 feet now. We need to restore the defender's dignity."\n\nThe proposal has reportedly received mixed reactions from players, with some guards expressing enthusiasm and most centers expressing "existential dread."\n\nCritics argue the change would make the game unrecognizable. Proponents argue that "so did the shot clock once, and look how that turned out."`,
    },
  ];

  const t = pick(templates);
  return {
    type: 'satire',
    title: t.title,
    subheadline: `In a story that is definitely real and not made up...`,
    publication: 'Courtside Chaos',
    body: t.body,
    cycle, isSatire: true,
    relatedTeams: [target.id], relatedPlayers: [], relatedUsers: [],
    metadata: {},
  };
}
```

- [ ] **Step 7: Implement Podcast generator**

```javascript
function generatePodcast(teams, games, teamStats, majorNews, rumor, cycle) {
  const topicNews = majorNews || (games.length > 0 ? { title: 'the latest action' } : { title: 'league developments' });
  const team1 = pick(teams);
  const team2 = pick(teams.filter(t => t.id !== team1?.id));
  if (!team1 || !team2) return null;

  const lines = [
    `On today's episode of Hardwood Hot Takes:`,
    `Host: "Let's talk about ${topicNews.title?.toLowerCase() || 'what happened around the league this week'}. ${team1?.name || 'Some teams'} are making noise — what do you make of it?"`,
    `Analyst: "${topicNews.title ? 'This is exactly the kind of storyline that defines a season.' : 'I think we\'re seeing the league settle into its pecking order.'} ${team1?.name} has shown flashes, but can they sustain it?"`,
    `Host: "${rumor ? `And those rumors about ${rumor.title?.split(':')[0]?.trim() || 'potential deals'} — legit or just smoke?` : 'The playoff picture is starting to take shape too.'}"`,
    `Analyst: "${rumor ? 'Where there\'s smoke, there\'s fire. I\'ve seen these types of negotiations before. Something will get done.' : 'Every game matters more now. Teams are starting to separate from the pack.'}"`,
    `Host: "Big week ahead. Buckle up, folks."`,
    `Analyst: "That's what makes this league great — you never know what's coming next."`,
    `Host: "We'll be back next cycle with more. Stay locked in."`,
  ];

  return {
    type: 'podcast',
    title: `Hardwood Hot Takes — Cycle ${cycle}`,
    subheadline: `Host and analyst break down the latest around the league`,
    publication: 'Hardwood Hot Takes',
    body: lines.join('\n\n'),
    cycle, isSatire: false,
    relatedTeams: [team1.id, team2.id], relatedPlayers: [], relatedUsers: [],
    metadata: {},
  };
}
```

- [ ] **Step 8: Implement Social Media generators**

```javascript
function generateSocialPosts(teams, games, majorNews, cycle) {
  const posts = [];
  const winners = games.filter(g => g.isCompleted === 1).slice(-3).map(g => {
    const home = teams.find(t => t.id === g.homeTeamId);
    const away = teams.find(t => t.id === g.awayTeamId);
    if (!home || !away) return null;
    const homeWon = g.homeScore > g.awayScore;
    return { game: g, winner: homeWon ? home : away, loser: homeWon ? away : home };
  }).filter(Boolean);

  if (winners.length > 0) {
    const w = pick(winners);
    const playerName = `${w.winner.name || 'Team'} player`;
    const templates = [
      `"Hard work pays off. Keep grinding." — ${playerName}`,
      `"Big win tonight. We're just getting started." — ${playerName}`,
      `"That one stung, but we'll be back." — ${w.loser.name || 'Team'} player`,
      `"Can't win 'em all. Back to the lab." — ${w.loser.name || 'Team'} player`,
      `"This team is different this year. Mark my words." — Analyst`,
      `"Front office cooking or crashing out?" — Analyst`,
      `"Still work to do." — Player`,
    ];
    posts.push({ text: pick(templates), author: 'Player/Insider' });
  }

  const reactions = [
    `"The East is wide open this year. Anyone's conference." — Analyst`,
    `"That trade rumor is NOT happening, sources say." — Insider`,
    `"Honestly, the product is better than ever this season." — Fan`,
    `"Just another day in the best league in the world." — Player`,
  ];
  posts.push({ text: pick(reactions), author: 'Fan/Analyst' });

  return posts.map((post, i) => ({
    type: 'social',
    title: `Post ${i + 1}`,
    subheadline: post.text,
    publication: pick(PUBLICATIONS.social),
    body: post.text,
    cycle, isSatire: false,
    relatedTeams: winners.length > 0 ? [winners[0].winner.id] : (teams.length > 0 ? [teams[0].id] : []),
    relatedPlayers: [], relatedUsers: [],
    metadata: { author: post.author },
  }));
}
```

- [ ] **Step 9: Implement Locker Room Banter generator**

```javascript
function generateLockerRoom(teams, games, cycle) {
  const recent = games.filter(g => g.isCompleted === 1).slice(-1);
  if (recent.length === 0 || teams.length < 2) {
    if (teams.length < 2) return null;
    const t1 = pick(teams);
    const t2 = pick(teams.filter(t => t.id !== t1?.id));
    if (!t1 || !t2) return null;
    return {
      type: 'locker_room',
      title: `${t1.name} Locker Room — Practice Session`,
      subheadline: `Behind the scenes with the ${t1.name}`,
      publication: pick(PUBLICATIONS.locker_room),
      body: `"That was a good practice today," one player said.\n"Coach is really pushing us this week," another responded. "He said the next game is a must-win."\n"Well, that's every game at this point," a veteran chimed in.\nThe room fell quiet for a moment before someone cracked a joke, breaking the tension.`,
      cycle, isSatire: false,
      relatedTeams: [t1.id, t2.id], relatedPlayers: [], relatedUsers: [],
      metadata: {},
    };
  }

  const g = recent[0];
  const home = teams.find(t => t.id === g.homeTeamId);
  const away = teams.find(t => t.id === g.awayTeamId);
  if (!home || !away) return null;

  const homeWon = g.homeScore > g.awayScore;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;

  const winTemplates = [
    `"We can't keep giving games away in the fourth," one ${loser.name} player said.\n"Coach said effort wasn't there tonight," another responded.\nThe locker room was quiet except for the sound of tape being ripped off ankles.`,
    `"This one's for the culture," a ${winner.name} veteran shouted.\n"Let's not get too high," a teammate cautioned. "We got another one in two days."\n"Let us enjoy this for five minutes," someone countered, as music started playing.`,
    `"Man, that was a W," a ${winner.name} player grinned.\n"Barely," another shot back. "We almost blew a 15-point lead."\n"A win's a win in this league," the first player replied, pulling on his hoodie.`,
  ];

  const loseTemplates = [
    `"That one's on me," a ${loser.name} player said quietly.\n"Nah, we win together and lose together," a teammate replied. "We'll get the next one."\nThe coach poked his head in. "Film session at 10 AM tomorrow. Be on time."`,
    `"We had them," someone muttered in the ${loser.name} locker room.\n"Twenty-four-hour rule," another said. "We watch the film, learn, and move on."\n"Easy for you to say. You didn't miss that shot."`,
  ];

  const body = pick(homeWon ? winTemplates : loseTemplates);

  return {
    type: 'locker_room',
    title: `${loser.name} Locker Room — ${homeWon ? 'Tough' : 'Hard'} Loss at Home`,
    subheadline: `Moments after the ${g.homeScore}-${g.awayScore} final`,
    publication: pick(PUBLICATIONS.locker_room),
    body,
    cycle, isSatire: false,
    relatedTeams: [home.id, away.id], relatedPlayers: [], relatedUsers: [],
    metadata: {},
  };
}
```

- [ ] **Step 10: Implement the orchestrator that runs all generators and saves to Firestore**

```javascript
export async function generateLeagueNews(leagueId) {
  const data = await loadLeagueData(leagueId);
  if (!data || data.teams.length === 0) return;

  const { league, teams, season, games, meta } = data;
  const teamStats = computeStats(teams, games);
  const cycle = (meta?.lastCycle || 0) + 1;

  const majorNews = generateMajorNews(teams, games, teamStats, season, cycle);
  const rumor = generateRumor(teams, games, teamStats, cycle);
  const satire = generateSatire(teams, teamStats, cycle);
  const podcast = generatePodcast(teams, games, teamStats, majorNews, rumor, cycle);
  const socialPosts = generateSocialPosts(teams, games, majorNews, cycle);
  const lockerRoom = generateLockerRoom(teams, games, cycle);

  const items = [majorNews, rumor, satire, podcast, ...socialPosts, lockerRoom].filter(Boolean);

  if (items.length === 0) return;

  const batch = writeBatch(db);
  for (const item of items) {
    const ref = doc(collection(db, 'leagues', leagueId, 'news'));
    batch.set(ref, {
      ...item,
      createdAt: new Date().toISOString(),
    });
  }
  await batch.commit();

  await setDoc(doc(db, 'leagues', leagueId, 'news_meta', 'state'), {
    lastCycle: cycle,
    lastGeneratedAt: new Date().toISOString(),
    activeStorylines: meta?.activeStorylines || {},
  }, { merge: true });
}

export async function checkAndGenerateNews(leagueId) {
  try {
    const metaSnap = await getDoc(doc(db, 'leagues', leagueId, 'news_meta', 'state'));
    if (metaSnap.exists()) {
      const meta = metaSnap.data();
      const elapsed = Date.now() - new Date(meta.lastGeneratedAt).getTime();
      const threeHours = 3 * 60 * 60 * 1000;
      if (elapsed < threeHours) return;
    }
    await generateLeagueNews(leagueId);
  } catch (e) {
    console.error('checkAndGenerateNews error:', e);
  }
}
```

---

### Task 2: Update NewsFeed.jsx — Newspaper-Style Display

**Files:**
- Modify: `frontend/src/pages/NewsFeed.jsx`

- [ ] **Step 1: Replace existing NewsFeed with full newspaper-style rendering**

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDocs, collection, query, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { leagueDoc, leagueNewsCol } from '../lib/firestore';
import { checkAndGenerateNews } from '../engine/newsEngine';

const TYPE_STYLES = {
  news: { border: 'border-l-[var(--accent-orange)]', icon: '📰', bg: 'from-[var(--accent-orange)]/5' },
  rumor: { border: 'border-l-[#60a5fa]', icon: '🔍', bg: 'from-blue-500/5' },
  satire: { border: 'border-l-[#a855f7]', icon: '🎭', bg: 'from-purple-500/5' },
  podcast: { border: 'border-l-[#22c55e]', icon: '🎙️', bg: 'from-green-500/5' },
  social: { border: 'border-l-[#3b82f6]', icon: '💬', bg: 'from-blue-500/5' },
  locker_room: { border: 'border-l-[#f59e0b]', icon: '🏠', bg: 'from-yellow-500/5' },
};

const PUBLICATION_COLORS = {
  'League Wire': 'text-blue-400 bg-blue-500/10',
  'Hardwood Insider': 'text-purple-400 bg-purple-500/10',
  'The Daily Dunk': 'text-orange-400 bg-orange-500/10',
  'Front Office Report': 'text-green-400 bg-green-500/10',
  'Courtside Chaos': 'text-pink-400 bg-pink-500/10',
  'The Basketball Chronicle': 'text-yellow-400 bg-yellow-500/10',
  'Hardwood Hot Takes': 'text-emerald-400 bg-emerald-500/10',
};

export default function NewsFeed() {
  const { leagueId } = useParams();
  const [news, setNews] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const lSnap = await getDoc(leagueDoc(leagueId));
      if (lSnap.exists()) setLeagueName(lSnap.data().name);

      try {
        await checkAndGenerateNews(leagueId);
      } catch (e) {}

      const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(50)));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [leagueId]);

  const cycles = useMemo(() => {
    const grouped = {};
    for (const item of news) {
      const c = item.cycle || 0;
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(item);
    }
    return Object.entries(grouped)
      .map(([cycle, items]) => ({ cycle: Number(cycle), items }))
      .sort((a, b) => b.cycle - a.cycle);
  }, [news]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display text-3xl tracking-wider">League News</h2>
          {leagueName && <p className="text-sm text-[var(--text-secondary)] mt-1">{leagueName}</p>}
        </div>
        <Link to={`/leagues/${leagueId}`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">← League</Link>
      </div>

      {cycles.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <div className="text-4xl mb-3">🏀</div>
          <p className="text-[var(--text-secondary)]">No news yet. Sim some games to generate content!</p>
        </div>
      ) : (
        cycles.map(({ cycle, items }) => (
          <div key={cycle} className="animate-fade-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--text-tertiary)]">Cycle {cycle}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
            </div>
            <div className="space-y-3">
              {items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item) => {
                const style = TYPE_STYLES[item.type] || TYPE_STYLES.news;
                const pubColor = PUBLICATION_COLORS[item.publication] || 'text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]';
                const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={item.id} className={`glass-card overflow-hidden border-l-2 ${style.border} bg-gradient-to-br ${style.bg} hover:bg-[var(--bg-tertiary)]/50 transition-all duration-200`}>
                    {item.type === 'podcast' ? (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{style.icon}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${pubColor}`}>{item.publication}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{dateStr}</span>
                        </div>
                        <h3 className="font-display text-lg tracking-wider text-white mb-2">{item.title}</h3>
                        <div className="space-y-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                          {item.body?.split('\n\n').map((line, i) => {
                            if (line.startsWith('Host:')) return <p key={i} className="text-[var(--accent-orange)] font-medium"><span className="text-xs uppercase tracking-wider opacity-70">Host:</span> {line.replace('Host:', '')}</p>;
                            if (line.startsWith('Analyst:')) return <p key={i} className="text-[var(--accent-teal)] font-medium"><span className="text-xs uppercase tracking-wider opacity-70">Analyst:</span> {line.replace('Analyst:', '')}</p>;
                            return <p key={i} className="text-xs text-[var(--text-tertiary)] italic">{line}</p>;
                          })}
                        </div>
                      </div>
                    ) : item.type === 'social' ? (
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-orange)] to-[var(--accent-red)] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1">
                            {item.metadata?.author?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">{item.metadata?.author || 'User'}</span>
                              <span className="text-[10px] text-[var(--text-tertiary)]">@{item.metadata?.author?.toLowerCase().replace(/\s+/g, '') || 'user'}</span>
                              <span className="text-[10px] text-[var(--text-tertiary)]">{dateStr}</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">{item.body}</p>
                          </div>
                        </div>
                      </div>
                    ) : item.type === 'locker_room' ? (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{style.icon}</span>
                          <span className="text-xs font-display tracking-wider text-white">{item.title}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{dateStr}</span>
                        </div>
                        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-subtle)]">
                          <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed whitespace-pre-line">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{style.icon}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${pubColor}`}>{item.publication}</span>
                          {item.isSatire && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">SATIRE</span>}
                          <span className="text-[10px] text-[var(--text-tertiary)]">{dateStr}</span>
                        </div>
                        <h3 className="font-display text-xl tracking-wider text-white mb-1 leading-tight">{item.title}</h3>
                        {item.subheadline && (
                          <p className="text-xs text-[var(--text-tertiary)] mb-3 italic">{item.subheadline}</p>
                        )}
                        <div className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-2 whitespace-pre-line">
                          {item.body}
                        </div>
                        {item.metadata?.stats && item.metadata.stats.length > 0 && (
                          <div className="flex gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                            {item.metadata.stats.map((s, i) => (
                              <div key={i} className="text-center">
                                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{s.label}</p>
                                <p className="text-sm font-display text-white">{s.value}</p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">{s.team}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.metadata?.homeTeam && item.metadata?.awayTeam && (
                          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                            <div className="text-right">
                              <p className="text-sm font-medium text-white">{item.metadata.homeTeam}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-display text-2xl text-white">{item.metadata.homeScore}</span>
                              <span className="text-[var(--text-tertiary)]">-</span>
                              <span className="font-display text-2xl text-white">{item.metadata.awayScore}</span>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">{item.metadata.awayTeam}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

---

### Task 3: Update LeagueNews.jsx — Integration

**Files:**
- Modify: `frontend/src/pages/LeagueNews.jsx`

- [ ] **Step 1: Add newsEngine import and trigger generation on expand**

Add import at top:
```jsx
import { checkAndGenerateNews } from '../engine/newsEngine';
```

Replace the `loadLeagueNews` function (lines 75-96):
```jsx
const loadLeagueNews = async (leagueId) => {
  if (newsCache[leagueId]) return;
  try {
    await checkAndGenerateNews(leagueId);
    const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(8)));
    setNewsCache(prev => ({ ...prev, [leagueId]: nSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));
  } catch (err) {
    console.error('loadLeagueNews error:', err);
    setNewsCache(prev => ({ ...prev, [leagueId]: [] }));
  }
};
```

Update the news rendering inside the accordion to show type-specific icons (replace lines 163-181):
```jsx
{item.type === 'social' ? (
  <div className="flex items-start gap-2 py-2 px-2">
    <span className="text-xs shrink-0 mt-0.5">💬</span>
    <div>
      <p className="text-xs text-[var(--text-secondary)] italic">"{item.body}"</p>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">— {item.metadata?.author || 'League source'}</p>
    </div>
  </div>
) : item.type === 'podcast' ? (
  <div className="py-2 px-2">
    <p className="text-xs font-medium text-[var(--accent-orange)]">🎙️ {item.title}</p>
    <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-2">{item.body?.split('\n\n').slice(0, 2).join(' ')}</p>
  </div>
) : (
  <div className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-default">
    <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5">
      <span>{item.type === 'satire' ? '🎭' : item.type === 'rumor' ? '🔍' : item.type === 'locker_room' ? '🏠' : '📰'}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-white leading-snug">{item.title || item.body?.slice(0, 60)}</p>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{item.subheadline || item.body?.slice(0, 80)}</p>
      <p className="text-[10px] text-[var(--text-tertiary)]/50 mt-0.5">
        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
        {item.publication ? ` · ${item.publication}` : ''}
      </p>
    </div>
  </div>
)}
```
