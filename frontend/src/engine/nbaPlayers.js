import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uid } from '../lib/firestore';
import NBA_PLAYER_POOL from './nbaPlayerPool.json';

const NBA_POOL_DOC = 'nba_players/pool';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const TWO_K_API = '/api';
const TWO_K_TTL = 60 * 60 * 1000;

let twoKCache = null;
let twoKCacheTime = 0;

async function fetch2kPlayers() {
  if (twoKCache && Date.now() - twoKCacheTime < TWO_K_TTL) return twoKCache;
  try {
    const res = await fetch(`${TWO_K_API}/players`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    twoKCache = data.players || [];
    twoKCacheTime = Date.now();
    return twoKCache;
  } catch (e) {
    console.warn('2K API unavailable, using fallback:', e.message);
    return null;
  }
}

function attrToCategory(attrs, keys) {
  const vals = keys.map(k => attrs[k]).filter(v => v != null && typeof v === 'number');
  if (vals.length === 0) return 50;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function map2kToGamePlayer(p, nbaTeamId) {
  const a = p.attributes || {};

  const offense = attrToCategory(a, ['layup', 'drivingDunk', 'standingDunk', 'postHook', 'postFade', 'postControl', 'drawFoul', 'hands', 'offensiveConsistency', 'shotIQ']);
  const defense = attrToCategory(a, ['block', 'steal', 'passPerception', 'interiorDefense', 'perimeterDefense', 'defensiveConsistency', 'helpDefenseIQ']);
  const shooting = attrToCategory(a, ['threePointShot', 'midRangeShot', 'closeShot', 'freeThrow']);
  const playmaking = attrToCategory(a, ['ballHandle', 'speedWithBall', 'passAccuracy', 'passVision', 'passIQ']);
  const rebounding = attrToCategory(a, ['defensiveRebound', 'offensiveRebound']);
  const athleticism = attrToCategory(a, ['speed', 'strength', 'agility', 'vertical', 'hustle', 'stamina', 'overallDurability']);

  const nameParts = (p.name || '').split(' ');
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.slice(1).join(' ') || 'Player';

  const twokPos = p.position || 'SF';
  const primaryPosition = twokPos.split('/')[0].trim();
  const canPlay = POSITION_ELIGIBILITY[primaryPosition] || POSITIONS;

  return {
    id: uid(),
    firstName,
    lastName,
    position: twokPos,
    primaryPosition,
    canPlay,
    nbaTeam: nbaTeamId || null,
    age: p.age || 24,
    height: parseHeight2k(p.height),
    weight: p.weight || 210,
    twokSlug: p.slug || null,
    twokPhoto: p.photoUrl || null,
    twokArchetype: p.archetype || null,
    badges: p.badges || 0,
    isAllStar: p.isAllStar || false,
    offense,
    defense,
    shooting,
    playmaking,
    rebounding,
    athleticism,
    overall: p.ovr || 50,
    potential: mapPotential(p.potential),
    twokAttributes: a,
    injuryProne: Math.floor(Math.random() * 30),
    morale: 50 + Math.floor(Math.random() * 30),
    contractYears: 1 + Math.floor(Math.random() * 4),
    contractValue: 500000 + Math.floor(Math.random() * 5000000),
    statsPpg: 0, statsRpg: 0, statsApg: 0, statsSpg: 0, statsBpg: 0,
    statsFgPct: 0.45, statsThreePct: 0.33, statsFtPct: 0.75 + (Math.random() * 0.15 - 0.08),
    statsGamesPlayed: 0,
    isInjured: false, injuryWeeks: 0,
  };
}

function parseHeight2k(ht) {
  if (!ht) return 78;
  const m = String(ht).match(/(\d+)'(\d+)"/);
  if (m) return parseInt(m[1]) * 12 + parseInt(m[2]);
  return 78;
}

function mapPotential(pot) {
  const map = { 'A+': 99, 'A': 95, 'A-': 90, 'B+': 85, 'B': 80, 'B-': 75, 'C+': 70, 'C': 65, 'C-': 60 };
  return map[pot] || 75;
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const POSITION_ELIGIBILITY = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

const POS_MAP = {
  'G': ['PG', 'SG'], 'F': ['SF', 'PF'], 'C': ['C'],
  'G-F': ['SG', 'SF'], 'F-G': ['SF', 'SG'],
  'C-F': ['C', 'PF'], 'F-C': ['PF', 'C'],
};

const NBA_TEAMS = [
  { id: 1, name: 'Hawks', fullName: 'Atlanta Hawks', slug: 'atlanta-hawks', city: 'Atlanta', abbr: 'ATL', conf: 'East' },
  { id: 2, name: 'Celtics', fullName: 'Boston Celtics', slug: 'boston-celtics', city: 'Boston', abbr: 'BOS', conf: 'East' },
  { id: 3, name: 'Nets', fullName: 'Brooklyn Nets', slug: 'brooklyn-nets', city: 'Brooklyn', abbr: 'BKN', conf: 'East' },
  { id: 4, name: 'Hornets', fullName: 'Charlotte Hornets', slug: 'charlotte-hornets', city: 'Charlotte', abbr: 'CHA', conf: 'East' },
  { id: 5, name: 'Bulls', fullName: 'Chicago Bulls', slug: 'chicago-bulls', city: 'Chicago', abbr: 'CHI', conf: 'East' },
  { id: 6, name: 'Cavaliers', fullName: 'Cleveland Cavaliers', slug: 'cleveland-cavaliers', city: 'Cleveland', abbr: 'CLE', conf: 'East' },
  { id: 7, name: 'Mavericks', fullName: 'Dallas Mavericks', slug: 'dallas-mavericks', city: 'Dallas', abbr: 'DAL', conf: 'West' },
  { id: 8, name: 'Nuggets', fullName: 'Denver Nuggets', slug: 'denver-nuggets', city: 'Denver', abbr: 'DEN', conf: 'West' },
  { id: 9, name: 'Pistons', fullName: 'Detroit Pistons', slug: 'detroit-pistons', city: 'Detroit', abbr: 'DET', conf: 'East' },
  { id: 10, name: 'Warriors', fullName: 'Golden State Warriors', slug: 'golden-state-warriors', city: 'Golden State', abbr: 'GSW', conf: 'West' },
  { id: 11, name: 'Rockets', fullName: 'Houston Rockets', slug: 'houston-rockets', city: 'Houston', abbr: 'HOU', conf: 'West' },
  { id: 12, name: 'Pacers', fullName: 'Indiana Pacers', slug: 'indiana-pacers', city: 'Indiana', abbr: 'IND', conf: 'East' },
  { id: 13, name: 'Clippers', fullName: 'LA Clippers', slug: 'la-clippers', city: 'LA', abbr: 'LAC', conf: 'West' },
  { id: 14, name: 'Lakers', fullName: 'Los Angeles Lakers', slug: 'los-angeles-lakers', city: 'Los Angeles', abbr: 'LAL', conf: 'West' },
  { id: 15, name: 'Grizzlies', fullName: 'Memphis Grizzlies', slug: 'memphis-grizzlies', city: 'Memphis', abbr: 'MEM', conf: 'West' },
  { id: 16, name: 'Heat', fullName: 'Miami Heat', slug: 'miami-heat', city: 'Miami', abbr: 'MIA', conf: 'East' },
  { id: 17, name: 'Bucks', fullName: 'Milwaukee Bucks', slug: 'milwaukee-bucks', city: 'Milwaukee', abbr: 'MIL', conf: 'East' },
  { id: 18, name: 'Timberwolves', fullName: 'Minnesota Timberwolves', slug: 'minnesota-timberwolves', city: 'Minnesota', abbr: 'MIN', conf: 'West' },
  { id: 19, name: 'Pelicans', fullName: 'New Orleans Pelicans', slug: 'new-orleans-pelicans', city: 'New Orleans', abbr: 'NOP', conf: 'West' },
  { id: 20, name: 'Knicks', fullName: 'New York Knicks', slug: 'new-york-knicks', city: 'New York', abbr: 'NYK', conf: 'East' },
  { id: 21, name: 'Thunder', fullName: 'Oklahoma City Thunder', slug: 'oklahoma-city-thunder', city: 'Oklahoma City', abbr: 'OKC', conf: 'West' },
  { id: 22, name: 'Magic', fullName: 'Orlando Magic', slug: 'orlando-magic', city: 'Orlando', abbr: 'ORL', conf: 'East' },
  { id: 23, name: '76ers', fullName: 'Philadelphia 76ers', slug: 'philadelphia-76ers', city: 'Philadelphia', abbr: 'PHI', conf: 'East' },
  { id: 24, name: 'Suns', fullName: 'Phoenix Suns', slug: 'phoenix-suns', city: 'Phoenix', abbr: 'PHX', conf: 'West' },
  { id: 25, name: 'Trail Blazers', fullName: 'Portland Trail Blazers', slug: 'portland-trail-blazers', city: 'Portland', abbr: 'POR', conf: 'West' },
  { id: 26, name: 'Kings', fullName: 'Sacramento Kings', slug: 'sacramento-kings', city: 'Sacramento', abbr: 'SAC', conf: 'West' },
  { id: 27, name: 'Spurs', fullName: 'San Antonio Spurs', slug: 'san-antonio-spurs', city: 'San Antonio', abbr: 'SAS', conf: 'East' },
  { id: 28, name: 'Raptors', fullName: 'Toronto Raptors', slug: 'toronto-raptors', city: 'Toronto', abbr: 'TOR', conf: 'East' },
  { id: 29, name: 'Jazz', fullName: 'Utah Jazz', slug: 'utah-jazz', city: 'Utah', abbr: 'UTA', conf: 'West' },
  { id: 30, name: 'Wizards', fullName: 'Washington Wizards', slug: 'washington-wizards', city: 'Washington', abbr: 'WAS', conf: 'East' },
];

/* ─── Real NBA player data (as of 2025-26 season) ─── */
const NBA_PLAYERS = [
  // Superstars (90-99 OVR)
  { fn: 'Giannis', ln: 'Antetokounmpo', pos: 'F', nbaTeam: 17, age: 31, ht: 83, wt: 243, ppg: 30.5, rpg: 11.8, apg: 6.2, spg: 1.3, bpg: 1.5, fgpct: 0.602, tpct: 0.284 },
  { fn: 'Luka', ln: 'Doncic', pos: 'G', nbaTeam: 7, age: 27, ht: 79, wt: 230, ppg: 31.2, rpg: 9.0, apg: 8.6, spg: 1.5, bpg: 0.6, fgpct: 0.486, tpct: 0.352 },
  { fn: 'Nikola', ln: 'Jokic', pos: 'C', nbaTeam: 8, age: 31, ht: 83, wt: 284, ppg: 27.5, rpg: 12.5, apg: 9.1, spg: 1.4, bpg: 0.9, fgpct: 0.581, tpct: 0.358 },
  { fn: 'Shai', ln: 'Gilgeous-Alexander', pos: 'G', nbaTeam: 21, age: 27, ht: 78, wt: 195, ppg: 31.8, rpg: 5.5, apg: 6.4, spg: 2.0, bpg: 0.9, fgpct: 0.535, tpct: 0.353 },
  { fn: 'Stephen', ln: 'Curry', pos: 'G', nbaTeam: 10, age: 37, ht: 74, wt: 185, ppg: 26.4, rpg: 4.5, apg: 5.1, spg: 0.9, bpg: 0.3, fgpct: 0.450, tpct: 0.408 },
  { fn: 'Jayson', ln: 'Tatum', pos: 'F', nbaTeam: 2, age: 27, ht: 80, wt: 210, ppg: 28.0, rpg: 8.5, apg: 5.2, spg: 1.1, bpg: 0.7, fgpct: 0.471, tpct: 0.370 },
  { fn: 'Joel', ln: 'Embiid', pos: 'C', nbaTeam: 23, age: 31, ht: 84, wt: 280, ppg: 30.2, rpg: 11.0, apg: 4.1, spg: 1.0, bpg: 1.7, fgpct: 0.529, tpct: 0.356 },
  { fn: 'Anthony', ln: 'Davis', pos: 'F', nbaTeam: 7, age: 32, ht: 82, wt: 253, ppg: 25.2, rpg: 12.3, apg: 3.6, spg: 1.2, bpg: 2.3, fgpct: 0.539, tpct: 0.298 },
  { fn: 'Kevin', ln: 'Durant', pos: 'F', nbaTeam: 24, age: 37, ht: 82, wt: 240, ppg: 27.1, rpg: 6.4, apg: 4.8, spg: 0.9, bpg: 1.3, fgpct: 0.522, tpct: 0.396 },
  { fn: 'Devin', ln: 'Booker', pos: 'G', nbaTeam: 24, age: 29, ht: 78, wt: 206, ppg: 27.6, rpg: 4.9, apg: 6.8, spg: 1.0, bpg: 0.4, fgpct: 0.493, tpct: 0.376 },
  { fn: 'Donovan', ln: 'Mitchell', pos: 'G', nbaTeam: 6, age: 29, ht: 75, wt: 215, ppg: 27.2, rpg: 5.0, apg: 5.8, spg: 1.5, bpg: 0.5, fgpct: 0.465, tpct: 0.368 },
  { fn: 'Anthony', ln: 'Edwards', pos: 'G', nbaTeam: 18, age: 24, ht: 76, wt: 225, ppg: 26.8, rpg: 5.5, apg: 5.0, spg: 1.3, bpg: 0.6, fgpct: 0.461, tpct: 0.363 },
  { fn: 'Victor', ln: 'Wembanyama', pos: 'C', nbaTeam: 27, age: 22, ht: 87, wt: 235, ppg: 23.8, rpg: 11.0, apg: 3.8, spg: 1.3, bpg: 3.6, fgpct: 0.475, tpct: 0.325 },
  { fn: 'Jalen', ln: 'Brunson', pos: 'G', nbaTeam: 20, age: 29, ht: 74, wt: 190, ppg: 27.0, rpg: 3.7, apg: 7.0, spg: 0.9, bpg: 0.2, fgpct: 0.482, tpct: 0.388 },
  { fn: 'Ja', ln: 'Morant', pos: 'G', nbaTeam: 15, age: 26, ht: 74, wt: 174, ppg: 25.8, rpg: 5.2, apg: 8.1, spg: 1.0, bpg: 0.4, fgpct: 0.471, tpct: 0.305 },

  // Stars (80-89 OVR)
  { fn: 'Tyrese', ln: 'Maxey', pos: 'G', nbaTeam: 23, age: 25, ht: 74, wt: 200, ppg: 24.5, rpg: 4.0, apg: 6.2, spg: 1.1, bpg: 0.4, fgpct: 0.462, tpct: 0.381 },
  { fn: 'Damian', ln: 'Lillard', pos: 'G', nbaTeam: 17, age: 35, ht: 74, wt: 195, ppg: 25.5, rpg: 4.3, apg: 6.8, spg: 1.0, bpg: 0.2, fgpct: 0.435, tpct: 0.372 },
  { fn: 'Jimmy', ln: 'Butler', pos: 'F', nbaTeam: 16, age: 36, ht: 79, wt: 230, ppg: 21.5, rpg: 5.2, apg: 5.0, spg: 1.8, bpg: 0.4, fgpct: 0.494, tpct: 0.342 },
  { fn: 'Bam', ln: 'Adebayo', pos: 'C', nbaTeam: 16, age: 28, ht: 81, wt: 255, ppg: 20.5, rpg: 10.2, apg: 3.8, spg: 1.2, bpg: 0.9, fgpct: 0.537, tpct: 0.000 },
  { fn: 'Pascal', ln: 'Siakam', pos: 'F', nbaTeam: 12, age: 31, ht: 80, wt: 245, ppg: 22.0, rpg: 7.5, apg: 4.2, spg: 0.9, bpg: 0.5, fgpct: 0.528, tpct: 0.345 },
  { fn: 'Trae', ln: 'Young', pos: 'G', nbaTeam: 1, age: 27, ht: 73, wt: 180, ppg: 26.0, rpg: 3.0, apg: 10.5, spg: 1.0, bpg: 0.2, fgpct: 0.435, tpct: 0.365 },
  { fn: 'DeAaron', ln: 'Fox', pos: 'G', nbaTeam: 27, age: 28, ht: 75, wt: 185, ppg: 25.5, rpg: 4.2, apg: 6.0, spg: 1.8, bpg: 0.5, fgpct: 0.465, tpct: 0.355 },
  { fn: 'Zion', ln: 'Williamson', pos: 'F', nbaTeam: 19, age: 26, ht: 78, wt: 284, ppg: 24.0, rpg: 6.8, apg: 4.8, spg: 1.2, bpg: 0.6, fgpct: 0.575, tpct: 0.300 },
  { fn: 'Chet', ln: 'Holmgren', pos: 'C', nbaTeam: 21, age: 23, ht: 85, wt: 208, ppg: 19.8, rpg: 9.2, apg: 2.5, spg: 0.8, bpg: 2.8, fgpct: 0.515, tpct: 0.367 },
  { fn: 'Paolo', ln: 'Banchero', pos: 'F', nbaTeam: 22, age: 23, ht: 82, wt: 250, ppg: 23.5, rpg: 7.5, apg: 5.0, spg: 1.0, bpg: 0.6, fgpct: 0.460, tpct: 0.335 },
  { fn: 'Cade', ln: 'Cunningham', pos: 'G', nbaTeam: 9, age: 24, ht: 78, wt: 220, ppg: 23.0, rpg: 5.0, apg: 7.5, spg: 1.2, bpg: 0.5, fgpct: 0.448, tpct: 0.352 },
  { fn: 'Kyrie', ln: 'Irving', pos: 'G', nbaTeam: 7, age: 33, ht: 74, wt: 195, ppg: 25.0, rpg: 4.8, apg: 5.5, spg: 1.3, bpg: 0.4, fgpct: 0.490, tpct: 0.405 },
  { fn: 'Karl-Anthony', ln: 'Towns', pos: 'C', nbaTeam: 20, age: 30, ht: 83, wt: 248, ppg: 22.5, rpg: 9.5, apg: 3.2, spg: 0.9, bpg: 1.2, fgpct: 0.505, tpct: 0.388 },
  { fn: 'Jaylen', ln: 'Brown', pos: 'F', nbaTeam: 2, age: 29, ht: 78, wt: 223, ppg: 23.5, rpg: 5.8, apg: 3.6, spg: 1.2, bpg: 0.5, fgpct: 0.482, tpct: 0.358 },
  { fn: 'Jamal', ln: 'Murray', pos: 'G', nbaTeam: 8, age: 29, ht: 76, wt: 215, ppg: 21.5, rpg: 4.2, apg: 6.5, spg: 1.0, bpg: 0.6, fgpct: 0.478, tpct: 0.398 },
  { fn: 'Brandon', ln: 'Ingram', pos: 'F', nbaTeam: 23, age: 28, ht: 80, wt: 210, ppg: 22.0, rpg: 5.5, apg: 5.2, spg: 0.9, bpg: 0.7, fgpct: 0.477, tpct: 0.365 },
  { fn: 'LaMelo', ln: 'Ball', pos: 'G', nbaTeam: 4, age: 24, ht: 79, wt: 180, ppg: 23.5, rpg: 5.8, apg: 8.2, spg: 1.6, bpg: 0.4, fgpct: 0.435, tpct: 0.375 },
  { fn: 'Scottie', ln: 'Barnes', pos: 'F', nbaTeam: 28, age: 24, ht: 80, wt: 237, ppg: 20.0, rpg: 8.5, apg: 6.0, spg: 1.3, bpg: 1.4, fgpct: 0.468, tpct: 0.341 },
  { fn: 'Desmond', ln: 'Bane', pos: 'G', nbaTeam: 15, age: 27, ht: 77, wt: 215, ppg: 22.5, rpg: 5.0, apg: 5.5, spg: 1.1, bpg: 0.5, fgpct: 0.468, tpct: 0.388 },
  { fn: 'Jaren', ln: 'Jackson Jr.', pos: 'F', nbaTeam: 15, age: 26, ht: 82, wt: 242, ppg: 19.5, rpg: 6.2, apg: 2.0, spg: 1.0, bpg: 2.5, fgpct: 0.497, tpct: 0.335 },
  { fn: 'RJ', ln: 'Barrett', pos: 'F', nbaTeam: 28, age: 25, ht: 78, wt: 214, ppg: 21.0, rpg: 5.5, apg: 3.5, spg: 0.8, bpg: 0.4, fgpct: 0.451, tpct: 0.352 },
  { fn: 'Tyrese', ln: 'Haliburton', pos: 'G', nbaTeam: 12, age: 26, ht: 77, wt: 185, ppg: 19.5, rpg: 4.0, apg: 10.0, spg: 1.2, bpg: 0.7, fgpct: 0.478, tpct: 0.385 },
  { fn: 'Julius', ln: 'Randle', pos: 'F', nbaTeam: 18, age: 31, ht: 80, wt: 250, ppg: 21.0, rpg: 9.0, apg: 4.5, spg: 0.8, bpg: 0.4, fgpct: 0.462, tpct: 0.332 },
  { fn: 'Darius', ln: 'Garland', pos: 'G', nbaTeam: 6, age: 26, ht: 73, wt: 192, ppg: 20.5, rpg: 2.8, apg: 7.8, spg: 1.2, bpg: 0.2, fgpct: 0.470, tpct: 0.382 },
  { fn: 'Evan', ln: 'Mobley', pos: 'C', nbaTeam: 6, age: 24, ht: 83, wt: 215, ppg: 17.5, rpg: 9.5, apg: 3.2, spg: 1.0, bpg: 1.8, fgpct: 0.561, tpct: 0.312 },
  { fn: 'CJ', ln: 'McCollum', pos: 'G', nbaTeam: 19, age: 34, ht: 75, wt: 190, ppg: 21.0, rpg: 4.0, apg: 5.5, spg: 1.0, bpg: 0.5, fgpct: 0.451, tpct: 0.385 },
  { fn: 'Mikal', ln: 'Bridges', pos: 'F', nbaTeam: 20, age: 29, ht: 78, wt: 209, ppg: 19.0, rpg: 4.5, apg: 3.5, spg: 1.0, bpg: 0.4, fgpct: 0.478, tpct: 0.372 },
  { fn: 'Amen', ln: 'Thompson', pos: 'F', nbaTeam: 11, age: 23, ht: 79, wt: 220, ppg: 16.5, rpg: 8.2, apg: 4.8, spg: 1.8, bpg: 1.0, fgpct: 0.530, tpct: 0.268 },
  { fn: 'Alperen', ln: 'Sengun', pos: 'C', nbaTeam: 11, age: 23, ht: 83, wt: 255, ppg: 18.5, rpg: 9.5, apg: 5.0, spg: 1.2, bpg: 0.8, fgpct: 0.509, tpct: 0.302 },
  { fn: 'Walker', ln: 'Kessler', pos: 'C', nbaTeam: 29, age: 24, ht: 84, wt: 245, ppg: 10.5, rpg: 11.0, apg: 1.2, spg: 0.6, bpg: 2.8, fgpct: 0.672, tpct: 0.000 },
  { fn: 'Austin', ln: 'Reaves', pos: 'G', nbaTeam: 14, age: 27, ht: 77, wt: 197, ppg: 17.5, rpg: 4.2, apg: 5.8, spg: 0.9, bpg: 0.3, fgpct: 0.468, tpct: 0.364 },
  { fn: 'Jalen', ln: 'Williams', pos: 'F', nbaTeam: 21, age: 24, ht: 78, wt: 211, ppg: 19.5, rpg: 5.0, apg: 5.0, spg: 1.5, bpg: 0.8, fgpct: 0.515, tpct: 0.405 },
  { fn: 'Chet', ln: 'Holmgren', pos: 'C', nbaTeam: 21, age: 23, ht: 85, wt: 208, ppg: 19.8, rpg: 9.2, apg: 2.5, spg: 0.8, bpg: 2.8, fgpct: 0.515, tpct: 0.367 },

  // Starters & rotation players (65-79 OVR)
  { fn: 'Immanuel', ln: 'Quickley', pos: 'G', nbaTeam: 28, age: 26, ht: 75, wt: 190, ppg: 16.5, rpg: 4.0, apg: 5.5, spg: 1.0, bpg: 0.2, fgpct: 0.432, tpct: 0.378 },
  { fn: 'Jabari', ln: 'Smith Jr.', pos: 'F', nbaTeam: 11, age: 22, ht: 82, wt: 220, ppg: 14.5, rpg: 7.5, apg: 1.5, spg: 0.8, bpg: 0.9, fgpct: 0.447, tpct: 0.358 },
  { fn: 'Keegan', ln: 'Murray', pos: 'F', nbaTeam: 26, age: 25, ht: 80, wt: 215, ppg: 15.0, rpg: 5.5, apg: 1.8, spg: 0.9, bpg: 0.7, fgpct: 0.458, tpct: 0.368 },
  { fn: 'Herb', ln: 'Jones', pos: 'F', nbaTeam: 19, age: 27, ht: 79, wt: 206, ppg: 12.8, rpg: 4.2, apg: 2.8, spg: 1.6, bpg: 0.8, fgpct: 0.466, tpct: 0.365 },
  { fn: 'Jaden', ln: 'McDaniels', pos: 'F', nbaTeam: 18, age: 25, ht: 81, wt: 205, ppg: 13.5, rpg: 4.0, apg: 1.8, spg: 1.0, bpg: 1.0, fgpct: 0.510, tpct: 0.348 },
  { fn: 'Onyeka', ln: 'Okongwu', pos: 'C', nbaTeam: 1, age: 26, ht: 80, wt: 235, ppg: 12.0, rpg: 8.5, apg: 2.2, spg: 0.8, bpg: 1.2, fgpct: 0.578, tpct: 0.333 },
  { fn: 'Keldon', ln: 'Johnson', pos: 'F', nbaTeam: 27, age: 26, ht: 77, wt: 220, ppg: 15.5, rpg: 5.5, apg: 2.8, spg: 0.9, bpg: 0.2, fgpct: 0.458, tpct: 0.342 },
  { fn: 'Jordan', ln: 'Poole', pos: 'G', nbaTeam: 30, age: 26, ht: 76, wt: 194, ppg: 17.5, rpg: 2.8, apg: 4.2, spg: 1.0, bpg: 0.3, fgpct: 0.415, tpct: 0.335 },
  { fn: 'Kyle', ln: 'Kuzma', pos: 'F', nbaTeam: 30, age: 30, ht: 81, wt: 221, ppg: 18.0, rpg: 7.0, apg: 3.5, spg: 0.7, bpg: 0.5, fgpct: 0.455, tpct: 0.342 },
  { fn: 'Tyler', ln: 'Herro', pos: 'G', nbaTeam: 16, age: 26, ht: 77, wt: 195, ppg: 20.0, rpg: 5.0, apg: 4.5, spg: 0.8, bpg: 0.2, fgpct: 0.448, tpct: 0.382 },
  { fn: 'Anfernee', ln: 'Simons', pos: 'G', nbaTeam: 25, age: 26, ht: 75, wt: 190, ppg: 19.0, rpg: 3.2, apg: 5.5, spg: 0.6, bpg: 0.2, fgpct: 0.436, tpct: 0.375 },
  { fn: 'Cole', ln: 'Anthony', pos: 'G', nbaTeam: 22, age: 25, ht: 74, wt: 185, ppg: 13.5, rpg: 4.5, apg: 4.8, spg: 0.8, bpg: 0.4, fgpct: 0.435, tpct: 0.361 },
  { fn: 'Franz', ln: 'Wagner', pos: 'F', nbaTeam: 22, age: 24, ht: 82, wt: 220, ppg: 18.5, rpg: 5.5, apg: 4.2, spg: 1.2, bpg: 0.5, fgpct: 0.478, tpct: 0.352 },
  { fn: 'Scoot', ln: 'Henderson', pos: 'G', nbaTeam: 25, age: 22, ht: 74, wt: 195, ppg: 14.5, rpg: 3.5, apg: 5.8, spg: 1.0, bpg: 0.3, fgpct: 0.415, tpct: 0.325 },
  { fn: 'Shaedon', ln: 'Sharpe', pos: 'G', nbaTeam: 25, age: 22, ht: 77, wt: 200, ppg: 16.0, rpg: 4.5, apg: 3.0, spg: 0.8, bpg: 0.5, fgpct: 0.445, tpct: 0.352 },
  { fn: 'Brandon', ln: 'Miller', pos: 'F', nbaTeam: 4, age: 23, ht: 81, wt: 200, ppg: 17.5, rpg: 4.5, apg: 2.5, spg: 1.0, bpg: 0.7, fgpct: 0.428, tpct: 0.368 },
  { fn: 'Keon', ln: 'Ellis', pos: 'G', nbaTeam: 26, age: 26, ht: 75, wt: 175, ppg: 8.5, rpg: 3.0, apg: 2.5, spg: 1.5, bpg: 0.8, fgpct: 0.468, tpct: 0.403 },
  { fn: 'Davion', ln: 'Mitchell', pos: 'G', nbaTeam: 16, age: 27, ht: 72, wt: 202, ppg: 8.5, rpg: 2.0, apg: 4.0, spg: 1.0, bpg: 0.3, fgpct: 0.432, tpct: 0.342 },
  { fn: 'Tari', ln: 'Eason', pos: 'F', nbaTeam: 11, age: 24, ht: 80, wt: 215, ppg: 11.5, rpg: 6.5, apg: 1.5, spg: 1.5, bpg: 0.8, fgpct: 0.460, tpct: 0.342 },
  { fn: 'Jalen', ln: 'Green', pos: 'G', nbaTeam: 11, age: 24, ht: 76, wt: 186, ppg: 20.0, rpg: 4.5, apg: 3.5, spg: 0.9, bpg: 0.3, fgpct: 0.425, tpct: 0.342 },
  { fn: 'Josh', ln: 'Giddey', pos: 'G', nbaTeam: 5, age: 23, ht: 80, wt: 210, ppg: 12.5, rpg: 6.5, apg: 5.8, spg: 0.9, bpg: 0.5, fgpct: 0.458, tpct: 0.328 },
  { fn: 'Zach', ln: 'LaVine', pos: 'G', nbaTeam: 5, age: 30, ht: 77, wt: 200, ppg: 21.5, rpg: 4.5, apg: 4.5, spg: 0.9, bpg: 0.3, fgpct: 0.462, tpct: 0.382 },
  { fn: 'Nikola', ln: 'Vucevic', pos: 'C', nbaTeam: 5, age: 35, ht: 82, wt: 260, ppg: 17.0, rpg: 10.5, apg: 3.5, spg: 0.8, bpg: 0.7, fgpct: 0.481, tpct: 0.352 },
  { fn: 'DeMar', ln: 'DeRozan', pos: 'F', nbaTeam: 26, age: 36, ht: 78, wt: 220, ppg: 22.0, rpg: 4.5, apg: 5.0, spg: 1.1, bpg: 0.4, fgpct: 0.481, tpct: 0.332 },
  { fn: 'Domantas', ln: 'Sabonis', pos: 'C', nbaTeam: 26, age: 29, ht: 82, wt: 240, ppg: 19.5, rpg: 12.5, apg: 7.5, spg: 0.9, bpg: 0.6, fgpct: 0.584, tpct: 0.372 },
  { fn: 'Klay', ln: 'Thompson', pos: 'G', nbaTeam: 7, age: 36, ht: 78, wt: 220, ppg: 16.5, rpg: 3.5, apg: 2.2, spg: 0.7, bpg: 0.4, fgpct: 0.438, tpct: 0.382 },
  { fn: 'Buddy', ln: 'Hield', pos: 'G', nbaTeam: 10, age: 33, ht: 76, wt: 220, ppg: 13.5, rpg: 3.5, apg: 2.8, spg: 0.8, bpg: 0.3, fgpct: 0.435, tpct: 0.385 },
  { fn: 'Dennis', ln: 'Schroder', pos: 'G', nbaTeam: 9, age: 32, ht: 73, wt: 175, ppg: 14.5, rpg: 2.8, apg: 5.5, spg: 0.8, bpg: 0.2, fgpct: 0.438, tpct: 0.352 },
  { fn: 'Bogdan', ln: 'Bogdanovic', pos: 'G', nbaTeam: 1, age: 33, ht: 76, wt: 220, ppg: 16.0, rpg: 3.5, apg: 3.2, spg: 0.8, bpg: 0.3, fgpct: 0.435, tpct: 0.372 },
  { fn: 'Malcolm', ln: 'Brogdon', pos: 'G', nbaTeam: 30, age: 33, ht: 76, wt: 229, ppg: 14.0, rpg: 4.0, apg: 4.5, spg: 0.8, bpg: 0.3, fgpct: 0.448, tpct: 0.365 },
  { fn: 'Jonas', ln: 'Valanciunas', pos: 'C', nbaTeam: 30, age: 33, ht: 83, wt: 265, ppg: 13.5, rpg: 11.0, apg: 2.5, spg: 0.5, bpg: 0.8, fgpct: 0.551, tpct: 0.348 },
  { fn: 'Clint', ln: 'Capela', pos: 'C', nbaTeam: 1, age: 31, ht: 82, wt: 256, ppg: 11.5, rpg: 11.0, apg: 1.2, spg: 0.6, bpg: 1.5, fgpct: 0.571, tpct: 0.000 },
  { fn: 'Jusuf', ln: 'Nurkic', pos: 'C', nbaTeam: 24, age: 31, ht: 84, wt: 290, ppg: 10.5, rpg: 10.0, apg: 3.5, spg: 0.9, bpg: 0.9, fgpct: 0.485, tpct: 0.289 },
  { fn: 'Ivica', ln: 'Zubac', pos: 'C', nbaTeam: 13, age: 29, ht: 84, wt: 240, ppg: 11.0, rpg: 9.8, apg: 1.5, spg: 0.5, bpg: 1.2, fgpct: 0.615, tpct: 0.000 },
  { fn: 'Daniel', ln: 'Gafford', pos: 'C', nbaTeam: 7, age: 27, ht: 82, wt: 234, ppg: 12.0, rpg: 8.0, apg: 1.5, spg: 0.5, bpg: 1.8, fgpct: 0.702, tpct: 0.000 },
  { fn: 'Naz', ln: 'Reid', pos: 'C', nbaTeam: 18, age: 26, ht: 81, wt: 264, ppg: 13.5, rpg: 5.5, apg: 1.8, spg: 0.8, bpg: 1.1, fgpct: 0.482, tpct: 0.382 },
  { fn: 'Bobby', ln: 'Portis', pos: 'F', nbaTeam: 17, age: 31, ht: 82, wt: 250, ppg: 13.0, rpg: 7.5, apg: 1.5, spg: 0.8, bpg: 0.5, fgpct: 0.470, tpct: 0.365 },
  { fn: 'Norman', ln: 'Powell', pos: 'G', nbaTeam: 13, age: 32, ht: 75, wt: 215, ppg: 15.5, rpg: 3.2, apg: 2.0, spg: 0.8, bpg: 0.3, fgpct: 0.478, tpct: 0.385 },
  { fn: 'Terance', ln: 'Mann', pos: 'G', nbaTeam: 13, age: 29, ht: 77, wt: 215, ppg: 9.5, rpg: 3.5, apg: 2.5, spg: 0.8, bpg: 0.3, fgpct: 0.468, tpct: 0.358 },
  { fn: 'Derrick', ln: 'White', pos: 'G', nbaTeam: 2, age: 31, ht: 76, wt: 200, ppg: 13.0, rpg: 4.0, apg: 4.8, spg: 1.0, bpg: 1.0, fgpct: 0.464, tpct: 0.382 },
  { fn: 'Kristaps', ln: 'Porzingis', pos: 'C', nbaTeam: 2, age: 30, ht: 86, wt: 240, ppg: 18.5, rpg: 7.0, apg: 2.0, spg: 0.7, bpg: 1.8, fgpct: 0.472, tpct: 0.358 },
  { fn: 'Al', ln: 'Horford', pos: 'C', nbaTeam: 2, age: 39, ht: 81, wt: 240, ppg: 8.5, rpg: 6.5, apg: 2.5, spg: 0.7, bpg: 0.9, fgpct: 0.462, tpct: 0.378 },
  { fn: 'Marcus', ln: 'Smart', pos: 'G', nbaTeam: 15, age: 32, ht: 75, wt: 220, ppg: 12.0, rpg: 3.5, apg: 5.5, spg: 1.6, bpg: 0.4, fgpct: 0.408, tpct: 0.332 },
  { fn: 'Luguentz', ln: 'Dort', pos: 'F', nbaTeam: 21, age: 26, ht: 76, wt: 220, ppg: 11.5, rpg: 4.0, apg: 1.5, spg: 1.0, bpg: 0.5, fgpct: 0.432, tpct: 0.362 },
  { fn: 'Gary', ln: 'Payton II', pos: 'G', nbaTeam: 10, age: 33, ht: 74, wt: 195, ppg: 7.5, rpg: 3.5, apg: 2.0, spg: 1.2, bpg: 0.3, fgpct: 0.518, tpct: 0.332 },
  { fn: 'Jonathan', ln: 'Kuminga', pos: 'F', nbaTeam: 10, age: 23, ht: 80, wt: 225, ppg: 16.0, rpg: 4.8, apg: 2.5, spg: 0.8, bpg: 0.5, fgpct: 0.488, tpct: 0.328 },
  { fn: 'Moses', ln: 'Moody', pos: 'G', nbaTeam: 10, age: 23, ht: 77, wt: 211, ppg: 9.5, rpg: 3.0, apg: 1.5, spg: 0.7, bpg: 0.3, fgpct: 0.448, tpct: 0.355 },
  { fn: 'Brandin', ln: 'Podziemski', pos: 'G', nbaTeam: 10, age: 23, ht: 76, wt: 205, ppg: 10.5, rpg: 5.5, apg: 3.5, spg: 1.0, bpg: 0.2, fgpct: 0.438, tpct: 0.355 },
  { fn: 'Trayce', ln: 'Jackson-Davis', pos: 'C', nbaTeam: 10, age: 26, ht: 81, wt: 245, ppg: 10.0, rpg: 7.5, apg: 2.0, spg: 0.5, bpg: 1.2, fgpct: 0.612, tpct: 0.000 },
  { fn: 'D\u2019Angelo', ln: 'Russell', pos: 'G', nbaTeam: 14, age: 30, ht: 75, wt: 193, ppg: 15.5, rpg: 3.0, apg: 5.5, spg: 0.9, bpg: 0.3, fgpct: 0.442, tpct: 0.372 },
  { fn: 'Rui', ln: 'Hachimura', pos: 'F', nbaTeam: 14, age: 28, ht: 80, wt: 230, ppg: 13.5, rpg: 4.8, apg: 1.5, spg: 0.7, bpg: 0.4, fgpct: 0.502, tpct: 0.378 },
  { fn: 'Jarred', ln: 'Vanderbilt', pos: 'F', nbaTeam: 14, age: 27, ht: 80, wt: 214, ppg: 6.0, rpg: 6.5, apg: 2.0, spg: 1.2, bpg: 0.4, fgpct: 0.512, tpct: 0.305 },
  { fn: 'Nikola', ln: 'Jovic', pos: 'F', nbaTeam: 16, age: 22, ht: 82, wt: 205, ppg: 9.0, rpg: 4.5, apg: 2.5, spg: 0.8, bpg: 0.4, fgpct: 0.455, tpct: 0.368 },
  { fn: 'Duncan', ln: 'Robinson', pos: 'F', nbaTeam: 16, age: 31, ht: 79, wt: 215, ppg: 11.5, rpg: 2.5, apg: 2.0, spg: 0.6, bpg: 0.3, fgpct: 0.445, tpct: 0.388 },
  { fn: 'Jaime', ln: 'Jaquez Jr.', pos: 'F', nbaTeam: 16, age: 25, ht: 78, wt: 225, ppg: 12.5, rpg: 4.5, apg: 2.8, spg: 1.0, bpg: 0.3, fgpct: 0.465, tpct: 0.335 },
  { fn: 'Nic', ln: 'Claxton', pos: 'C', nbaTeam: 3, age: 26, ht: 83, wt: 215, ppg: 11.5, rpg: 9.5, apg: 2.2, spg: 0.7, bpg: 2.2, fgpct: 0.628, tpct: 0.200 },
  { fn: 'Cameron', ln: 'Thomas', pos: 'G', nbaTeam: 3, age: 24, ht: 76, wt: 210, ppg: 21.0, rpg: 3.0, apg: 3.5, spg: 0.7, bpg: 0.2, fgpct: 0.442, tpct: 0.362 },
  { fn: 'Mikal', ln: 'Bridges', pos: 'F', nbaTeam: 3, age: 29, ht: 78, wt: 209, ppg: 19.5, rpg: 4.8, apg: 3.5, spg: 1.0, bpg: 0.6, fgpct: 0.472, tpct: 0.365 },
  { fn: 'Cameron', ln: 'Johnson', pos: 'F', nbaTeam: 3, age: 30, ht: 80, wt: 210, ppg: 15.5, rpg: 4.5, apg: 2.5, spg: 0.8, bpg: 0.4, fgpct: 0.458, tpct: 0.388 },
  { fn: 'Dorian', ln: 'Finney-Smith', pos: 'F', nbaTeam: 3, age: 32, ht: 79, wt: 220, ppg: 9.5, rpg: 4.8, apg: 1.5, spg: 0.8, bpg: 0.5, fgpct: 0.435, tpct: 0.368 },
  { fn: 'Myles', ln: 'Turner', pos: 'C', nbaTeam: 12, age: 29, ht: 83, wt: 250, ppg: 17.0, rpg: 7.0, apg: 1.5, spg: 0.7, bpg: 2.3, fgpct: 0.508, tpct: 0.358 },
  { fn: 'Buddy', ln: 'Hield', pos: 'G', nbaTeam: 12, age: 33, ht: 76, wt: 220, ppg: 12.5, rpg: 3.2, apg: 2.5, spg: 0.8, bpg: 0.3, fgpct: 0.428, tpct: 0.372 },
  { fn: 'Bennedict', ln: 'Mathurin', pos: 'F', nbaTeam: 12, age: 23, ht: 77, wt: 210, ppg: 16.5, rpg: 4.5, apg: 2.0, spg: 0.7, bpg: 0.3, fgpct: 0.452, tpct: 0.352 },
  { fn: 'Andrew', ln: 'Nembhard', pos: 'G', nbaTeam: 12, age: 26, ht: 76, wt: 195, ppg: 11.5, rpg: 3.0, apg: 5.0, spg: 1.0, bpg: 0.2, fgpct: 0.465, tpct: 0.345 },
  { fn: 'Aaron', ln: 'Nesmith', pos: 'F', nbaTeam: 12, age: 26, ht: 77, wt: 215, ppg: 12.0, rpg: 4.0, apg: 1.5, spg: 0.9, bpg: 0.6, fgpct: 0.462, tpct: 0.375 },
  { fn: 'Jarrett', ln: 'Allen', pos: 'C', nbaTeam: 6, age: 27, ht: 83, wt: 243, ppg: 14.5, rpg: 10.5, apg: 2.5, spg: 0.8, bpg: 1.5, fgpct: 0.645, tpct: 0.000 },
  { fn: 'Caris', ln: 'LeVert', pos: 'G', nbaTeam: 6, age: 31, ht: 78, wt: 205, ppg: 12.5, rpg: 3.5, apg: 4.0, spg: 1.0, bpg: 0.4, fgpct: 0.435, tpct: 0.352 },
  { fn: 'Max', ln: 'Strus', pos: 'F', nbaTeam: 6, age: 29, ht: 77, wt: 215, ppg: 11.0, rpg: 4.0, apg: 3.0, spg: 0.8, bpg: 0.3, fgpct: 0.428, tpct: 0.368 },
  { fn: 'OG', ln: 'Anunoby', pos: 'F', nbaTeam: 20, age: 28, ht: 79, wt: 240, ppg: 15.5, rpg: 4.8, apg: 2.2, spg: 1.5, bpg: 0.8, fgpct: 0.478, tpct: 0.375 },
  { fn: 'Josh', ln: 'Hart', pos: 'F', nbaTeam: 20, age: 31, ht: 76, wt: 215, ppg: 10.5, rpg: 8.5, apg: 4.0, spg: 1.0, bpg: 0.3, fgpct: 0.448, tpct: 0.345 },
  { fn: 'Donte', ln: 'DiVincenzo', pos: 'G', nbaTeam: 18, age: 29, ht: 76, wt: 203, ppg: 11.5, rpg: 3.5, apg: 2.8, spg: 1.2, bpg: 0.4, fgpct: 0.438, tpct: 0.375 },
  { fn: 'Jaden', ln: 'Hardy', pos: 'G', nbaTeam: 7, age: 23, ht: 76, wt: 198, ppg: 9.5, rpg: 2.5, apg: 2.8, spg: 0.5, bpg: 0.2, fgpct: 0.428, tpct: 0.358 },
  { fn: 'Dereck', ln: 'Lively II', pos: 'C', nbaTeam: 7, age: 22, ht: 85, wt: 230, ppg: 9.0, rpg: 7.5, apg: 2.2, spg: 0.6, bpg: 1.5, fgpct: 0.718, tpct: 0.000 },
  { fn: 'P.J.', ln: 'Washington', pos: 'F', nbaTeam: 7, age: 27, ht: 79, wt: 230, ppg: 12.0, rpg: 5.8, apg: 2.0, spg: 0.8, bpg: 0.9, fgpct: 0.445, tpct: 0.358 },
  { fn: 'Naji', ln: 'Marshall', pos: 'F', nbaTeam: 7, age: 28, ht: 79, wt: 220, ppg: 10.0, rpg: 4.0, apg: 2.5, spg: 0.8, bpg: 0.3, fgpct: 0.452, tpct: 0.345 },
  { fn: 'Daniel', ln: 'Theis', pos: 'C', nbaTeam: 21, age: 33, ht: 80, wt: 245, ppg: 6.5, rpg: 4.5, apg: 1.0, spg: 0.4, bpg: 0.6, fgpct: 0.525, tpct: 0.338 },
  { fn: 'Aaron', ln: 'Gordon', pos: 'F', nbaTeam: 8, age: 30, ht: 80, wt: 235, ppg: 14.0, rpg: 6.5, apg: 3.5, spg: 0.8, bpg: 0.6, fgpct: 0.542, tpct: 0.328 },
  { fn: 'Michael', ln: 'Porter Jr.', pos: 'F', nbaTeam: 8, age: 27, ht: 82, wt: 218, ppg: 16.5, rpg: 7.0, apg: 1.5, spg: 0.6, bpg: 0.6, fgpct: 0.485, tpct: 0.395 },
  { fn: 'Aaron', ln: 'Gordon', pos: 'F', nbaTeam: 8, age: 30, ht: 80, wt: 235, ppg: 13.5, rpg: 6.2, apg: 3.2, spg: 0.8, bpg: 0.6, fgpct: 0.535, tpct: 0.322 },
  { fn: 'Christian', ln: 'Braun', pos: 'F', nbaTeam: 8, age: 24, ht: 78, wt: 220, ppg: 10.5, rpg: 4.5, apg: 1.8, spg: 0.8, bpg: 0.4, fgpct: 0.508, tpct: 0.342 },
  { fn: 'Peyton', ln: 'Watson', pos: 'F', nbaTeam: 8, age: 23, ht: 79, wt: 200, ppg: 8.5, rpg: 3.5, apg: 1.5, spg: 0.7, bpg: 0.6, fgpct: 0.462, tpct: 0.335 },
  { fn: 'Bruce', ln: 'Brown Jr.', pos: 'F', nbaTeam: 19, age: 29, ht: 76, wt: 202, ppg: 10.0, rpg: 4.5, apg: 3.0, spg: 0.8, bpg: 0.4, fgpct: 0.472, tpct: 0.325 },
  { fn: 'Trey', ln: 'Murphy III', pos: 'F', nbaTeam: 19, age: 25, ht: 80, wt: 206, ppg: 15.0, rpg: 5.0, apg: 2.5, spg: 0.9, bpg: 0.5, fgpct: 0.468, tpct: 0.378 },
  { fn: 'Jose', ln: 'Alvarado', pos: 'G', nbaTeam: 19, age: 27, ht: 72, wt: 179, ppg: 8.0, rpg: 2.5, apg: 3.5, spg: 1.3, bpg: 0.2, fgpct: 0.435, tpct: 0.345 },
  { fn: 'Luke', ln: 'Kornet', pos: 'C', nbaTeam: 2, age: 30, ht: 85, wt: 250, ppg: 5.5, rpg: 4.0, apg: 1.0, spg: 0.4, bpg: 0.9, fgpct: 0.618, tpct: 0.000 },
  { fn: 'Payton', ln: 'Pritchard', pos: 'G', nbaTeam: 2, age: 28, ht: 73, wt: 195, ppg: 12.5, rpg: 3.5, apg: 4.0, spg: 0.6, bpg: 0.2, fgpct: 0.442, tpct: 0.375 },
  { fn: 'Sam', ln: 'Hauser', pos: 'F', nbaTeam: 2, age: 28, ht: 79, wt: 218, ppg: 8.5, rpg: 3.5, apg: 1.0, spg: 0.6, bpg: 0.3, fgpct: 0.438, tpct: 0.392 },
  { fn: 'Jrue', ln: 'Holiday', pos: 'G', nbaTeam: 2, age: 35, ht: 76, wt: 205, ppg: 12.0, rpg: 4.5, apg: 4.8, spg: 0.9, bpg: 0.6, fgpct: 0.475, tpct: 0.408 },
  { fn: 'Khris', ln: 'Middleton', pos: 'F', nbaTeam: 17, age: 34, ht: 79, wt: 222, ppg: 14.0, rpg: 4.5, apg: 5.0, spg: 0.8, bpg: 0.3, fgpct: 0.472, tpct: 0.378 },
  { fn: 'Brook', ln: 'Lopez', pos: 'C', nbaTeam: 17, age: 37, ht: 85, wt: 282, ppg: 12.0, rpg: 5.0, apg: 1.5, spg: 0.6, bpg: 2.5, fgpct: 0.482, tpct: 0.358 },
  { fn: 'Malik', ln: 'Beasley', pos: 'G', nbaTeam: 9, age: 29, ht: 76, wt: 187, ppg: 12.5, rpg: 3.0, apg: 2.0, spg: 0.8, bpg: 0.1, fgpct: 0.438, tpct: 0.385 },
  { fn: 'Ausar', ln: 'Thompson', pos: 'F', nbaTeam: 9, age: 23, ht: 79, wt: 205, ppg: 10.5, rpg: 6.5, apg: 2.5, spg: 1.5, bpg: 0.9, fgpct: 0.478, tpct: 0.285 },
  { fn: 'Jaden', ln: 'Ivey', pos: 'G', nbaTeam: 9, age: 24, ht: 76, wt: 200, ppg: 17.5, rpg: 4.0, apg: 5.0, spg: 0.9, bpg: 0.5, fgpct: 0.448, tpct: 0.352 },
  { fn: 'Isaiah', ln: 'Stewart', pos: 'C', nbaTeam: 9, age: 24, ht: 80, wt: 250, ppg: 10.5, rpg: 7.5, apg: 2.0, spg: 0.6, bpg: 0.9, fgpct: 0.488, tpct: 0.348 },
  { fn: 'Lu', ln: 'Dort', pos: 'F', nbaTeam: 21, age: 26, ht: 76, wt: 220, ppg: 11.0, rpg: 3.8, apg: 1.5, spg: 0.9, bpg: 0.4, fgpct: 0.435, tpct: 0.358 },
  { fn: 'Isaiah', ln: 'Joe', pos: 'G', nbaTeam: 21, age: 26, ht: 75, wt: 165, ppg: 9.5, rpg: 2.5, apg: 2.0, spg: 0.6, bpg: 0.1, fgpct: 0.448, tpct: 0.402 },
  { fn: 'Cason', ln: 'Wallace', pos: 'G', nbaTeam: 21, age: 22, ht: 76, wt: 205, ppg: 8.5, rpg: 3.0, apg: 2.5, spg: 1.0, bpg: 0.5, fgpct: 0.455, tpct: 0.365 },
  { fn: 'Aaron', ln: 'Wiggins', pos: 'F', nbaTeam: 21, age: 27, ht: 78, wt: 200, ppg: 8.0, rpg: 3.5, apg: 1.5, spg: 0.8, bpg: 0.4, fgpct: 0.475, tpct: 0.358 },
  { fn: 'Kenrich', ln: 'Williams', pos: 'F', nbaTeam: 21, age: 31, ht: 78, wt: 210, ppg: 6.5, rpg: 4.0, apg: 2.0, spg: 0.8, bpg: 0.3, fgpct: 0.475, tpct: 0.365 },
  { fn: 'Isaiah', ln: 'Hartenstein', pos: 'C', nbaTeam: 21, age: 27, ht: 84, wt: 250, ppg: 8.5, rpg: 8.5, apg: 2.5, spg: 0.9, bpg: 1.2, fgpct: 0.545, tpct: 0.300 },
  { fn: 'Vince', ln: 'Williams Jr.', pos: 'G', nbaTeam: 8, age: 25, ht: 76, wt: 205, ppg: 7.5, rpg: 3.5, apg: 3.5, spg: 1.0, bpg: 0.5, fgpct: 0.432, tpct: 0.335 },
  { fn: 'Jalen', ln: 'Smith', pos: 'C', nbaTeam: 11, age: 25, ht: 82, wt: 215, ppg: 10.5, rpg: 6.5, apg: 1.5, spg: 0.5, bpg: 1.0, fgpct: 0.492, tpct: 0.328 },
  { fn: 'De\u2019Andre', ln: 'Hunter', pos: 'F', nbaTeam: 1, age: 28, ht: 80, wt: 225, ppg: 15.0, rpg: 4.0, apg: 1.8, spg: 0.7, bpg: 0.3, fgpct: 0.458, tpct: 0.372 },
  { fn: 'Jalen', ln: 'Johnson', pos: 'F', nbaTeam: 1, age: 24, ht: 81, wt: 215, ppg: 16.0, rpg: 8.0, apg: 4.0, spg: 1.2, bpg: 0.9, fgpct: 0.502, tpct: 0.348 },
  { fn: 'Dyson', ln: 'Daniels', pos: 'G', nbaTeam: 1, age: 22, ht: 79, wt: 195, ppg: 10.5, rpg: 4.5, apg: 3.5, spg: 2.0, bpg: 0.5, fgpct: 0.445, tpct: 0.315 },
  { fn: 'Grayson', ln: 'Allen', pos: 'G', nbaTeam: 24, age: 30, ht: 76, wt: 198, ppg: 11.5, rpg: 3.5, apg: 2.5, spg: 0.8, bpg: 0.5, fgpct: 0.468, tpct: 0.388 },
  { fn: 'Bradley', ln: 'Beal', pos: 'G', nbaTeam: 24, age: 32, ht: 76, wt: 207, ppg: 18.5, rpg: 4.0, apg: 5.0, spg: 1.0, bpg: 0.4, fgpct: 0.488, tpct: 0.375 },
  { fn: 'Jusuf', ln: 'Nurkic', pos: 'C', nbaTeam: 24, age: 31, ht: 84, wt: 290, ppg: 10.5, rpg: 10.0, apg: 3.5, spg: 0.9, bpg: 0.9, fgpct: 0.485, tpct: 0.289 },
  { fn: 'Royce', ln: 'ONeale', pos: 'F', nbaTeam: 24, age: 32, ht: 76, wt: 226, ppg: 8.5, rpg: 4.5, apg: 3.0, spg: 0.8, bpg: 0.5, fgpct: 0.438, tpct: 0.375 },
  { fn: 'Keon', ln: 'Johnson', pos: 'G', nbaTeam: 24, age: 24, ht: 77, wt: 185, ppg: 7.5, rpg: 3.5, apg: 1.5, spg: 1.0, bpg: 0.3, fgpct: 0.435, tpct: 0.355 },
  { fn: 'Dalano', ln: 'Banton', pos: 'G', nbaTeam: 25, age: 26, ht: 80, wt: 204, ppg: 9.0, rpg: 3.5, apg: 3.0, spg: 0.7, bpg: 0.5, fgpct: 0.442, tpct: 0.332 },
  { fn: 'Toumani', ln: 'Camara', pos: 'F', nbaTeam: 25, age: 25, ht: 80, wt: 220, ppg: 10.0, rpg: 5.5, apg: 1.8, spg: 1.2, bpg: 0.5, fgpct: 0.448, tpct: 0.355 },
  { fn: 'Deandre', ln: 'Ayton', pos: 'C', nbaTeam: 25, age: 27, ht: 83, wt: 250, ppg: 16.0, rpg: 11.0, apg: 1.8, spg: 0.7, bpg: 0.9, fgpct: 0.565, tpct: 0.000 },
  { fn: 'Jerami', ln: 'Grant', pos: 'F', nbaTeam: 25, age: 32, ht: 79, wt: 210, ppg: 18.0, rpg: 4.0, apg: 2.8, spg: 0.8, bpg: 0.7, fgpct: 0.458, tpct: 0.378 },
  { fn: 'Matisse', ln: 'Thybulle', pos: 'F', nbaTeam: 25, age: 29, ht: 77, wt: 200, ppg: 5.5, rpg: 2.5, apg: 1.2, spg: 1.6, bpg: 0.7, fgpct: 0.425, tpct: 0.345 },
  { fn: 'Malik', ln: 'Monk', pos: 'G', nbaTeam: 26, age: 28, ht: 75, wt: 200, ppg: 15.0, rpg: 3.0, apg: 5.0, spg: 0.7, bpg: 0.4, fgpct: 0.438, tpct: 0.358 },
  { fn: 'Kevin', ln: 'Huerter', pos: 'G', nbaTeam: 26, age: 27, ht: 79, wt: 198, ppg: 11.0, rpg: 3.5, apg: 2.8, spg: 0.7, bpg: 0.4, fgpct: 0.442, tpct: 0.372 },
  { fn: 'Harrison', ln: 'Barnes', pos: 'F', nbaTeam: 27, age: 33, ht: 80, wt: 225, ppg: 12.0, rpg: 3.5, apg: 1.5, spg: 0.6, bpg: 0.2, fgpct: 0.468, tpct: 0.378 },
  { fn: 'Devin', ln: 'Vassell', pos: 'G', nbaTeam: 27, age: 25, ht: 77, wt: 205, ppg: 17.5, rpg: 4.0, apg: 3.5, spg: 1.2, bpg: 0.4, fgpct: 0.455, tpct: 0.365 },
  { fn: 'Keldon', ln: 'Johnson', pos: 'F', nbaTeam: 27, age: 26, ht: 77, wt: 220, ppg: 15.5, rpg: 5.5, apg: 2.8, spg: 0.9, bpg: 0.2, fgpct: 0.458, tpct: 0.342 },
  { fn: 'Jeremy', ln: 'Sochan', pos: 'F', nbaTeam: 27, age: 22, ht: 80, wt: 230, ppg: 11.0, rpg: 6.5, apg: 3.5, spg: 1.0, bpg: 0.4, fgpct: 0.452, tpct: 0.305 },
  { fn: 'Tre', ln: 'Jones', pos: 'G', nbaTeam: 27, age: 26, ht: 73, wt: 185, ppg: 10.0, rpg: 3.0, apg: 6.0, spg: 1.2, bpg: 0.1, fgpct: 0.488, tpct: 0.332 },
  { fn: 'Zach', ln: 'Collins', pos: 'C', nbaTeam: 27, age: 28, ht: 83, wt: 250, ppg: 9.5, rpg: 5.5, apg: 2.5, spg: 0.5, bpg: 0.7, fgpct: 0.465, tpct: 0.335 },
  { fn: 'Blake', ln: 'Wesley', pos: 'G', nbaTeam: 27, age: 23, ht: 76, wt: 185, ppg: 6.5, rpg: 2.0, apg: 3.0, spg: 0.7, bpg: 0.2, fgpct: 0.412, tpct: 0.318 },
  { fn: 'Malaki', ln: 'Branham', pos: 'G', nbaTeam: 27, age: 22, ht: 76, wt: 205, ppg: 9.0, rpg: 2.5, apg: 2.5, spg: 0.5, bpg: 0.2, fgpct: 0.425, tpct: 0.342 },
  { fn: 'RJ', ln: 'Barrett', pos: 'F', nbaTeam: 28, age: 25, ht: 78, wt: 214, ppg: 21.0, rpg: 5.5, apg: 3.5, spg: 0.8, bpg: 0.4, fgpct: 0.451, tpct: 0.352 },
  { fn: 'Gradey', ln: 'Dick', pos: 'G', nbaTeam: 28, age: 22, ht: 80, wt: 200, ppg: 12.5, rpg: 3.5, apg: 1.8, spg: 0.8, bpg: 0.2, fgpct: 0.435, tpct: 0.362 },
  { fn: 'Jakob', ln: 'Poeltl', pos: 'C', nbaTeam: 28, age: 30, ht: 84, wt: 260, ppg: 11.5, rpg: 9.0, apg: 2.5, spg: 0.8, bpg: 1.4, fgpct: 0.635, tpct: 0.000 },
  { fn: 'Jahmai', ln: 'Jones', pos: 'G', nbaTeam: 28, age: 27, ht: 76, wt: 200, ppg: 5.5, rpg: 2.5, apg: 2.0, spg: 1.2, bpg: 0.5, fgpct: 0.435, tpct: 0.332 },
  { fn: 'Chris', ln: 'Boucher', pos: 'F', nbaTeam: 28, age: 33, ht: 81, wt: 200, ppg: 9.0, rpg: 4.5, apg: 0.5, spg: 0.5, bpg: 0.7, fgpct: 0.462, tpct: 0.345 },
  { fn: 'Lauri', ln: 'Markkanen', pos: 'F', nbaTeam: 29, age: 28, ht: 84, wt: 240, ppg: 20.5, rpg: 8.0, apg: 2.2, spg: 0.8, bpg: 0.6, fgpct: 0.468, tpct: 0.372 },
  { fn: 'Collin', ln: 'Sexton', pos: 'G', nbaTeam: 29, age: 27, ht: 73, wt: 190, ppg: 17.5, rpg: 2.5, apg: 4.5, spg: 0.8, bpg: 0.2, fgpct: 0.452, tpct: 0.378 },
  { fn: 'Jordan', ln: 'Clarkson', pos: 'G', nbaTeam: 29, age: 33, ht: 75, wt: 194, ppg: 15.0, rpg: 3.0, apg: 4.5, spg: 0.6, bpg: 0.2, fgpct: 0.415, tpct: 0.342 },
  { fn: 'John', ln: 'Collins', pos: 'F', nbaTeam: 29, age: 28, ht: 81, wt: 235, ppg: 14.5, rpg: 8.0, apg: 1.5, spg: 0.7, bpg: 0.8, fgpct: 0.528, tpct: 0.368 },
  { fn: 'Keyonte', ln: 'George', pos: 'G', nbaTeam: 29, age: 22, ht: 76, wt: 185, ppg: 13.0, rpg: 3.0, apg: 5.5, spg: 0.7, bpg: 0.2, fgpct: 0.418, tpct: 0.352 },
  { fn: 'Bilal', ln: 'Coulibaly', pos: 'F', nbaTeam: 30, age: 21, ht: 80, wt: 195, ppg: 10.5, rpg: 4.5, apg: 2.5, spg: 1.0, bpg: 0.8, fgpct: 0.445, tpct: 0.325 },
  { fn: 'Deni', ln: 'Avdija', pos: 'F', nbaTeam: 25, age: 25, ht: 81, wt: 215, ppg: 14.0, rpg: 7.0, apg: 3.5, spg: 0.9, bpg: 0.5, fgpct: 0.468, tpct: 0.352 },
  { fn: 'Corey', ln: 'Kispert', pos: 'F', nbaTeam: 30, age: 27, ht: 79, wt: 220, ppg: 13.0, rpg: 3.5, apg: 2.0, spg: 0.6, bpg: 0.2, fgpct: 0.468, tpct: 0.382 },
  { fn: 'Tim', ln: 'Hardaway Jr.', pos: 'G', nbaTeam: 9, age: 33, ht: 77, wt: 205, ppg: 14.0, rpg: 3.0, apg: 2.0, spg: 0.6, bpg: 0.2, fgpct: 0.425, tpct: 0.362 },
  { fn: 'Marcus', ln: 'Sasser', pos: 'G', nbaTeam: 9, age: 25, ht: 74, wt: 200, ppg: 8.5, rpg: 2.0, apg: 3.5, spg: 0.6, bpg: 0.2, fgpct: 0.435, tpct: 0.358 },
  { fn: 'Miles', ln: 'Bridges', pos: 'F', nbaTeam: 4, age: 28, ht: 78, wt: 210, ppg: 19.0, rpg: 7.0, apg: 3.0, spg: 0.9, bpg: 0.6, fgpct: 0.455, tpct: 0.342 },
  { fn: 'Mark', ln: 'Williams', pos: 'C', nbaTeam: 4, age: 24, ht: 84, wt: 240, ppg: 12.5, rpg: 9.5, apg: 1.5, spg: 0.7, bpg: 1.2, fgpct: 0.615, tpct: 0.000 },
  { fn: 'Grant', ln: 'Williams', pos: 'F', nbaTeam: 4, age: 27, ht: 78, wt: 236, ppg: 10.0, rpg: 4.5, apg: 2.5, spg: 0.7, bpg: 0.5, fgpct: 0.448, tpct: 0.368 },
  { fn: 'Nick', ln: 'Richards', pos: 'C', nbaTeam: 24, age: 28, ht: 84, wt: 245, ppg: 10.0, rpg: 8.0, apg: 1.0, spg: 0.4, bpg: 1.2, fgpct: 0.618, tpct: 0.000 },
  { fn: 'Zach', ln: 'Edey', pos: 'C', nbaTeam: 15, age: 23, ht: 88, wt: 300, ppg: 11.5, rpg: 9.0, apg: 1.5, spg: 0.4, bpg: 1.3, fgpct: 0.582, tpct: 0.000 },
  { fn: 'GG', ln: 'Jackson II', pos: 'F', nbaTeam: 4, age: 22, ht: 81, wt: 210, ppg: 14.0, rpg: 4.5, apg: 1.8, spg: 0.7, bpg: 0.5, fgpct: 0.442, tpct: 0.352 },
  { fn: 'Keyonte', ln: 'George', pos: 'G', nbaTeam: 29, age: 22, ht: 76, wt: 185, ppg: 13.0, rpg: 3.0, apg: 5.5, spg: 0.7, bpg: 0.2, fgpct: 0.418, tpct: 0.352 },
  { fn: 'Taylor', ln: 'Hendricks', pos: 'F', nbaTeam: 29, age: 22, ht: 81, wt: 215, ppg: 8.5, rpg: 4.5, apg: 1.0, spg: 0.6, bpg: 0.8, fgpct: 0.438, tpct: 0.358 },
  { fn: 'Scotty', ln: 'Pippen Jr.', pos: 'G', nbaTeam: 15, age: 25, ht: 73, wt: 170, ppg: 9.0, rpg: 2.5, apg: 4.5, spg: 1.0, bpg: 0.3, fgpct: 0.442, tpct: 0.342 },
  { fn: 'Goga', ln: 'Bitadze', pos: 'C', nbaTeam: 22, age: 26, ht: 83, wt: 250, ppg: 8.0, rpg: 7.0, apg: 1.5, spg: 0.5, bpg: 1.5, fgpct: 0.572, tpct: 0.000 },
  { fn: 'Wendell', ln: 'Carter Jr.', pos: 'C', nbaTeam: 22, age: 26, ht: 82, wt: 270, ppg: 11.5, rpg: 8.5, apg: 2.0, spg: 0.7, bpg: 0.7, fgpct: 0.525, tpct: 0.365 },
  { fn: 'Moritz', ln: 'Wagner', pos: 'C', nbaTeam: 22, age: 28, ht: 83, wt: 245, ppg: 11.0, rpg: 4.5, apg: 1.5, spg: 0.5, bpg: 0.4, fgpct: 0.555, tpct: 0.338 },
  { fn: 'Anthony', ln: 'Black', pos: 'G', nbaTeam: 22, age: 22, ht: 79, wt: 200, ppg: 8.5, rpg: 3.5, apg: 3.0, spg: 1.0, bpg: 0.5, fgpct: 0.452, tpct: 0.335 },
  { fn: 'Jett', ln: 'Howard', pos: 'F', nbaTeam: 22, age: 22, ht: 80, wt: 215, ppg: 7.5, rpg: 3.0, apg: 1.5, spg: 0.4, bpg: 0.3, fgpct: 0.422, tpct: 0.355 },
  { fn: 'Caleb', ln: 'Houstan', pos: 'F', nbaTeam: 22, age: 24, ht: 80, wt: 205, ppg: 6.0, rpg: 2.5, apg: 1.0, spg: 0.4, bpg: 0.2, fgpct: 0.415, tpct: 0.362 },
  { fn: 'Marcus', ln: 'Garrett', pos: 'F', nbaTeam: 3, age: 27, ht: 79, wt: 215, ppg: 6.5, rpg: 4.0, apg: 1.5, spg: 0.6, bpg: 0.5, fgpct: 0.448, tpct: 0.332 },
  { fn: 'DayRon', ln: 'Sharpe', pos: 'C', nbaTeam: 3, age: 24, ht: 83, wt: 265, ppg: 7.5, rpg: 7.0, apg: 1.5, spg: 0.5, bpg: 0.8, fgpct: 0.574, tpct: 0.000 },
  { fn: 'Jalen', ln: 'Wilson', pos: 'F', nbaTeam: 3, age: 25, ht: 80, wt: 225, ppg: 6.5, rpg: 3.5, apg: 1.5, spg: 0.5, bpg: 0.3, fgpct: 0.448, tpct: 0.342 },
  { fn: 'Kris', ln: 'Murray', pos: 'F', nbaTeam: 25, age: 25, ht: 80, wt: 215, ppg: 7.5, rpg: 3.5, apg: 1.5, spg: 0.6, bpg: 0.4, fgpct: 0.435, tpct: 0.342 },
  { fn: 'Rayan', ln: 'Rupert', pos: 'F', nbaTeam: 25, age: 21, ht: 79, wt: 205, ppg: 4.5, rpg: 2.5, apg: 1.5, spg: 0.6, bpg: 0.3, fgpct: 0.418, tpct: 0.328 },
  { fn: 'Jabari', ln: 'Walker', pos: 'F', nbaTeam: 25, age: 23, ht: 80, wt: 215, ppg: 7.5, rpg: 4.0, apg: 1.5, spg: 0.7, bpg: 0.4, fgpct: 0.435, tpct: 0.338 },
  { fn: 'Duop', ln: 'Reath', pos: 'C', nbaTeam: 25, age: 29, ht: 83, wt: 245, ppg: 6.0, rpg: 3.5, apg: 1.0, spg: 0.4, bpg: 0.6, fgpct: 0.485, tpct: 0.355 },
  { fn: 'Jake', ln: 'LaRavia', pos: 'F', nbaTeam: 26, age: 24, ht: 79, wt: 235, ppg: 7.5, rpg: 4.0, apg: 1.5, spg: 0.7, bpg: 0.4, fgpct: 0.442, tpct: 0.345 },
  { fn: 'Colby', ln: 'Jones', pos: 'G', nbaTeam: 26, age: 23, ht: 78, wt: 205, ppg: 6.0, rpg: 3.0, apg: 2.0, spg: 0.7, bpg: 0.3, fgpct: 0.428, tpct: 0.342 },
  { fn: 'Jordan', ln: 'Hawkins', pos: 'G', nbaTeam: 19, age: 23, ht: 77, wt: 185, ppg: 9.5, rpg: 2.5, apg: 2.0, spg: 0.5, bpg: 0.2, fgpct: 0.425, tpct: 0.362 },
  { fn: 'Cody', ln: 'Williams', pos: 'F', nbaTeam: 29, age: 21, ht: 80, wt: 205, ppg: 7.5, rpg: 3.5, apg: 1.5, spg: 0.7, bpg: 0.5, fgpct: 0.428, tpct: 0.335 },
  { fn: 'Isaiah', ln: 'Collier', pos: 'G', nbaTeam: 29, age: 21, ht: 75, wt: 210, ppg: 8.0, rpg: 2.5, apg: 4.5, spg: 0.8, bpg: 0.2, fgpct: 0.418, tpct: 0.325 },
  { fn: 'Kyle', ln: 'Filipowski', pos: 'C', nbaTeam: 29, age: 22, ht: 83, wt: 250, ppg: 7.0, rpg: 5.5, apg: 2.0, spg: 0.6, bpg: 0.7, fgpct: 0.455, tpct: 0.332 },
  { fn: 'Brice', ln: 'Sensabaugh', pos: 'F', nbaTeam: 29, age: 22, ht: 78, wt: 235, ppg: 8.5, rpg: 3.0, apg: 1.5, spg: 0.4, bpg: 0.2, fgpct: 0.425, tpct: 0.358 },
  { fn: 'Jared', ln: 'Butler', pos: 'G', nbaTeam: 30, age: 25, ht: 75, wt: 195, ppg: 9.0, rpg: 2.5, apg: 3.5, spg: 0.8, bpg: 0.2, fgpct: 0.448, tpct: 0.352 },
  { fn: 'Johnny', ln: 'Davis', pos: 'G', nbaTeam: 30, age: 24, ht: 76, wt: 195, ppg: 8.5, rpg: 3.0, apg: 2.5, spg: 0.6, bpg: 0.3, fgpct: 0.435, tpct: 0.332 },
  { fn: 'Patrick', ln: 'Baldwin Jr.', pos: 'F', nbaTeam: 30, age: 23, ht: 81, wt: 220, ppg: 6.5, rpg: 4.0, apg: 1.0, spg: 0.5, bpg: 0.5, fgpct: 0.438, tpct: 0.352 },
  { fn: 'Eugene', ln: 'Omoruyi', pos: 'F', nbaTeam: 30, age: 29, ht: 78, wt: 235, ppg: 5.5, rpg: 3.0, apg: 1.0, spg: 0.5, bpg: 0.3, fgpct: 0.442, tpct: 0.332 },
  { fn: 'Tristan', ln: 'Vukcevic', pos: 'C', nbaTeam: 30, age: 23, ht: 84, wt: 260, ppg: 5.0, rpg: 3.5, apg: 0.5, spg: 0.4, bpg: 0.6, fgpct: 0.438, tpct: 0.332 },
];

/* ─── Helpers ─── */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function mapPosition(nbaPos) {
  return pick(POS_MAP[nbaPos] || ['SF']);
}

function calcOverall(ppg, rpg, apg, spg, bpg, fgpct, tpct) {
  const score = ppg * 1.8 + rpg * 1.3 + apg * 1.4 + spg * 3.5 + bpg * 3.5 + (fgpct - 0.4) * 120 + (tpct - 0.3) * 80;
  return clamp(Math.round(score), 40, 99);
}

function calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, type) {
  const base = calcOverall(ppg, rpg, apg, spg, bpg, fgpct, tpct);
  const variance = Math.floor(Math.random() * 20) - 10;
  switch (type) {
    case 'offense': return clamp(Math.round(ppg * 2.5 + apg * 1.5 + 10 + variance), 20, 99);
    case 'defense': return clamp(Math.round(spg * 8 + bpg * 8 + (1 - fgpct) * 60 + variance), 20, 99);
    case 'shooting': return clamp(Math.round((fgpct * 80 + tpct * 50) + 10 + variance), 20, 99);
    case 'playmaking': return clamp(Math.round(apg * 8 + ppg * 0.3 + 15 + variance), 20, 99);
    case 'rebounding': return clamp(Math.round(rpg * 5 + 10 + variance), 20, 99);
    case 'athleticism': return clamp(Math.round(40 + ppg + variance), 20, 99);
    default: return base;
  }
}

function mapToGamePlayer(apiPlayer) {
  const pos = mapPosition(apiPlayer.pos);
  const ppg = apiPlayer.ppg || 0;
  const rpg = apiPlayer.rpg || 0;
  const apg = apiPlayer.apg || 0;
  const spg = apiPlayer.spg || 0;
  const bpg = apiPlayer.bpg || 0;
  const fgpct = apiPlayer.fgpct || 0.45;
  const tpct = apiPlayer.tpct || 0.33;
  const overall = calcOverall(ppg, rpg, apg, spg, bpg, fgpct, tpct);

  return {
    id: uid(),
    firstName: apiPlayer.fn,
    lastName: apiPlayer.ln,
    position: pos,
    nbaTeam: apiPlayer.nbaTeam || null,
    age: apiPlayer.age || 24,
    height: apiPlayer.ht || 78,
    weight: apiPlayer.wt || 210,
    offense: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'offense'),
    defense: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'defense'),
    shooting: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'shooting'),
    playmaking: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'playmaking'),
    rebounding: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'rebounding'),
    athleticism: calcAttr(ppg, rpg, apg, spg, bpg, fgpct, tpct, 'athleticism'),
    overall,
    potential: clamp(overall + Math.floor(Math.random() * 12) + 3, 40, 99),
    injuryProne: Math.floor(Math.random() * 30),
    morale: 50 + Math.floor(Math.random() * 30),
    contractYears: 1 + Math.floor(Math.random() * 4),
    contractValue: 500000 + Math.floor(Math.random() * 5000000),
    statsPpg: ppg, statsRpg: rpg, statsApg: apg, statsSpg: spg, statsBpg: bpg,
    statsFgPct: fgpct, statsThreePct: tpct, statsFtPct: 0.75 + (Math.random() * 0.15 - 0.08),
    statsGamesPlayed: 0,
    isInjured: false, injuryWeeks: 0,
  };
}

/* ─── API Integration (requires API key) ─── */

async function fetchFromApi(endpoint) {
  const apiKey = process.env.REACT_APP_BALLDONTLIE_KEY;
  if (!apiKey) return null;
  const res = await fetch(`${NBA_API_BASE}${endpoint}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchApiPlayers() {
  let allPlayers = [];
  let cursor = null;
  for (let i = 0; i < 10; i++) {
    const params = `?per_page=100${cursor ? `&cursor=${cursor}` : ''}`;
    const data = await fetchFromApi(`/nba/v1/players${params}`);
    if (!data?.data) break;
    allPlayers = allPlayers.concat(data.data);
    if (!data.meta?.next_cursor) break;
    cursor = data.meta.next_cursor;
  }
  return allPlayers;
}

async function fetchApiAverages(playerIds) {
  const season = new Date().getFullYear() - (new Date().getMonth() < 10 ? 1 : 0);
  const averages = {};
  const data = await fetchFromApi(`/nba/v1/season_averages?season=${season}&player_id=${playerIds[0]}`);
  if (data?.data) {
    for (const avg of data.data) {
      averages[avg.player_id] = avg;
    }
  }
  return averages;
}

/* ─── Public API ─── */

export async function ensureNbaPool() {
  const pool = NBA_PLAYER_POOL.players || [];
  if (pool.length > 0) return pool.length;
  try {
    const snap = await getDoc(doc(db, NBA_POOL_DOC));
    if (snap.exists()) return snap.data().players?.length || 0;
  } catch {}
  const mapped = NBA_PLAYERS.map(p => mapToGamePlayer(p));
  return mapped.length;
}

export async function getNbaPlayerPool() {
  try {
    const snap = await getDoc(doc(db, NBA_POOL_DOC));
    if (snap.exists()) return snap.data().players || [];
  } catch {}
  return [];
}

export async function draftNbaPlayers(count = 5) {
  const pool = NBA_PLAYER_POOL.players || [];
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function parseHeight(str) {
  if (!str || typeof str !== 'string') return 78;
  const parts = str.split('-');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 12 + parseInt(parts[1]);
  }
  return 78;
}
