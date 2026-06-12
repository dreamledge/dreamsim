const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const NBA2KLAB_ROSTER_URL = 'https://www.nba2klab.com/.netlify/functions/player-roster';
const CACHE_DIR = path.join(__dirname, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'nba2klab-roster.json');
const MAX_RETRIES = 3;
const BATCH_SAVE_INTERVAL = 50;
const CONCURRENCY_LIMIT = 5;

const POTENTIAL_MAP = {
  'A+': 99, 'A': 95, 'A-': 90,
  'B+': 85, 'B': 80, 'B-': 75,
  'C+': 70, 'C': 65, 'C-': 60,
  'D+': 55, 'D': 50, 'D-': 45,
  'F': 40
};

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadCache() {
  ensureCacheDir();
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('[Cache] Failed to load cache:', e.message);
  }
  return null;
}

function saveCache(data) {
  ensureCacheDir();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Cache] Saved ${data.length} players to cache`);
  } catch (e) {
    console.warn('[Cache] Failed to save cache:', e.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Fetch] Attempt ${attempt}/${retries} - ${url}`);
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      });
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`[Fetch] Success - ${response.data.length} players received`);
        return response.data;
      }
      throw new Error(`Unexpected response: ${response.status}`);
    } catch (err) {
      console.warn(`[Fetch] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`[Fetch] Retrying in ${backoff}ms...`);
        await sleep(backoff);
      }
    }
  }
  return null;
}

function normalizeName(name) {
  if (!name) return name;
  const suffixes = [' Jr.', ' Sr.', ' II', ' III', ' IV', ' V'];
  let result = name.trim();
  for (const suffix of suffixes) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length).trim();
      break;
    }
  }
  return result;
}

function parseHeight(heightStr) {
  if (!heightStr) return null;
  const cleaned = heightStr.replace(/["\s]/g, '');
  const match = cleaned.match(/(\d+)'(\d+)/);
  if (match) {
    const feet = parseInt(match[1]);
    const inches = parseInt(match[2]);
    return { feet, inches, totalInches: feet * 12 + inches };
  }
  return null;
}

function parsePosition(posStr) {
  if (!posStr) return { primary: 'SF', secondary: null };
  const parts = posStr.split('|').map(p => p.trim());
  const primary = parts[0] || 'SF';
  const secondary = parts[1] || null;
  return { primary, secondary };
}

function mapPotential(grade) {
  if (!grade) return null;
  const upper = grade.toUpperCase().trim();
  if (POTENTIAL_MAP[upper]) return POTENTIAL_MAP[upper];
  const match = upper.match(/^([A-F])([+-]?)$/);
  if (match) {
    const letter = match[1];
    const mod = match[2];
    const base = { 'A': 95, 'B': 80, 'C': 65, 'D': 50, 'F': 40 }[letter] || 70;
    const adj = { '+': 5, '-': -5, '': 0 }[mod] || 0;
    return Math.min(99, Math.max(40, base + adj));
  }
  return 75;
}

function calcPotentialByAge(age) {
  if (age === null || age === undefined) return 75;
  if (age <= 23) return 80 + Math.floor(Math.random() * 20);
  if (age <= 28) return 75 + Math.floor(Math.random() * 21);
  return 60 + Math.floor(Math.random() * 31);
}

function mapRawPlayer(raw) {
  const playerId = uuidv4();
  const fullName = `${raw.first_name} ${raw.last_name}`;
  const pos = parsePosition(raw.position);
  const height = parseHeight(raw.height);
  const wingspan = parseHeight(raw.wingspan);

  const attributes = {
    offense: {
      closeShot: raw.close ?? null,
      midRange: raw.mid ?? null,
      threePoint: raw['3pt'] ?? null,
      freeThrow: raw.ft ?? null,
      layup: raw.layup ?? null,
      drivingDunk: raw.dunk ?? null,
      standingDunk: raw.stdnk ?? null,
      postHook: raw.phook ?? null,
      postFade: raw.pfade ?? null,
      postControl: raw.postc ?? null,
      drawFoul: raw.foul ?? null,
      shotIQ: raw.shotiq ?? null,
      offensiveConsistency: raw.offcon ?? null,
    },
    playmaking: {
      passAccuracy: raw.pass ?? null,
      ballHandle: raw.ball ?? null,
      speedWithBall: raw.spdball ?? null,
      passIQ: raw.passiq ?? null,
      passVision: raw.vision ?? null,
    },
    defense: {
      interiorDefense: raw.idef ?? null,
      perimeterDefense: raw.pdef ?? null,
      steal: raw.steal ?? null,
      block: raw.block ?? null,
      helpDefenseIQ: raw.helpdiq ?? null,
      passPerception: raw.passper ?? null,
      defensiveConsistency: raw.defcon ?? null,
    },
    athleticism: {
      speed: raw.speed ?? null,
      agility: raw.aglty ?? null,
      strength: raw.str ?? null,
      vertical: raw.vert ?? null,
      stamina: raw.stam ?? null,
      hustle: raw.hustle ?? null,
      durability: raw.dur ?? null,
    },
    mental: {
      intangibles: raw.intngbl ?? null,
    }
  };

  attributes.athleticism.acceleration = raw.speed !== null ? Math.round(raw.speed * 0.95) : null;

  attributes.mental.offensiveAwareness = calculateOffAwareness(raw);
  attributes.mental.defensiveAwareness = calculateDefAwareness(raw);

  const badges = generateBadges(raw);
  const tendencies = calculateTendencies(raw);
  const overall = raw.rating ?? calculateOverall(raw);
  const potential = raw.pot ? mapPotential(raw.pot) : calcPotentialByAge(raw.age);

  return {
    playerId,
    fullName,
    firstName: raw.first_name,
    lastName: raw.last_name,
    jerseyNumber: null,
    position: pos.primary,
    secondaryPosition: pos.secondary,
    age: raw.age ?? null,
    birthDate: null,
    country: null,
    college: null,
    yearsPro: null,
    draftYear: null,
    draftRound: null,
    draftPick: null,
    height: height ? `${height.feet}'${height.inches}"` : null,
    heightInches: height ? height.totalInches : null,
    weight: raw.weight ?? null,
    wingspan: wingspan ? `${wingspan.feet}'${wingspan.inches}"` : null,
    wingspanInches: wingspan ? wingspan.totalInches : null,
    standingReach: null,
    team: raw.team ?? null,
    overall,
    potential,
    attributes,
    badges,
    tendencies,
    nbaStats: {
      pointsPerGame: null,
      reboundsPerGame: null,
      assistsPerGame: null,
      stealsPerGame: null,
      blocksPerGame: null,
      turnoversPerGame: null,
      minutesPerGame: null,
      fieldGoalPercentage: null,
      threePointPercentage: null,
      freeThrowPercentage: null,
      gamesPlayed: null,
    },
    advancedStats: {
      playerEfficiencyRating: null,
      trueShootingPercentage: null,
      effectiveFieldGoalPercentage: null,
      usageRate: null,
      winShares: null,
      boxPlusMinus: null,
      valueOverReplacementPlayer: null,
    }
  };
}

function calculateOffAwareness(raw) {
  const vals = [raw.shotiq, raw.offcon, raw.vision, raw.passiq].filter(v => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function calculateDefAwareness(raw) {
  const vals = [raw.helpdiq, raw.passper, raw.defcon].filter(v => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function calculateOverall(raw) {
  const offenseAttrs = [raw.close, raw.mid, raw['3pt'], raw.ft, raw.layup, raw.dunk, raw.stdnk, raw.phook, raw.pfade, raw.postc, raw.shotiq, raw.offcon].filter(v => v !== null && v !== undefined);
  const defenseAttrs = [raw.idef, raw.pdef, raw.steal, raw.block, raw.helpdiq, raw.passper, raw.defcon].filter(v => v !== null && v !== undefined);
  const athleticAttrs = [raw.speed, raw.aglty, raw.str, raw.vert, raw.stam, raw.hustle].filter(v => v !== null && v !== undefined);
  const mentalAttrs = [raw.intngbl, raw.shotiq, raw.offcon, raw.defcon, raw.passiq].filter(v => v !== null && v !== undefined);

  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 50;

  const offenseScore = avg(offenseAttrs);
  const defenseScore = avg(defenseAttrs);
  const athleticScore = avg(athleticAttrs);
  const mentalScore = avg(mentalAttrs);

  const overall = offenseScore * 0.40 + defenseScore * 0.30 + athleticScore * 0.20 + mentalScore * 0.10;
  return Math.round(Math.min(99, Math.max(40, overall)));
}

function generateBadges(raw) {
  const badges = [];

  const badgeThresholds = [
    { attr: 'close', name: 'Posterizer', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: 'layup', name: 'Giant Slayer', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: '3pt', name: 'Limitless Range', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: 'mid', name: 'Dead Eye', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 85, level: 'Gold' }, { min: 75, level: 'Silver' }, { min: 65, level: 'Bronze' }] },
    { attr: 'ball', name: 'Handles for Days', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: 'spdball', name: 'Speed Booster', levels: [{ min: 88, level: 'Hall of Fame' }, { min: 78, level: 'Gold' }, { min: 68, level: 'Silver' }, { min: 58, level: 'Bronze' }] },
    { attr: 'pass', name: 'Dimer', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: 'vision', name: 'Floor General', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
    { attr: 'steal', name: 'Interceptor', levels: [{ min: 85, level: 'Hall of Fame' }, { min: 75, level: 'Gold' }, { min: 65, level: 'Silver' }, { min: 55, level: 'Bronze' }] },
    { attr: 'block', name: 'Anchor', levels: [{ min: 88, level: 'Hall of Fame' }, { min: 78, level: 'Gold' }, { min: 68, level: 'Silver' }, { min: 58, level: 'Bronze' }] },
    { attr: 'idef', name: 'Post Lockdown', levels: [{ min: 85, level: 'Hall of Fame' }, { min: 75, level: 'Gold' }, { min: 65, level: 'Silver' }, { min: 55, level: 'Bronze' }] },
    { attr: 'pdef', name: 'Clamps', levels: [{ min: 88, level: 'Hall of Fame' }, { min: 78, level: 'Gold' }, { min: 68, level: 'Silver' }, { min: 58, level: 'Bronze' }] },
    { attr: 'oreb', name: 'Rebound Chaser', levels: [{ min: 85, level: 'Hall of Fame' }, { min: 75, level: 'Gold' }, { min: 65, level: 'Silver' }, { min: 55, level: 'Bronze' }] },
    { attr: 'dreb', name: 'Boxout Beast', levels: [{ min: 85, level: 'Hall of Fame' }, { min: 75, level: 'Gold' }, { min: 65, level: 'Silver' }, { min: 55, level: 'Bronze' }] },
    { attr: 'phook', name: 'Dream Shake', levels: [{ min: 85, level: 'Hall of Fame' }, { min: 75, level: 'Gold' }, { min: 65, level: 'Silver' }, { min: 55, level: 'Bronze' }] },
    { attr: 'stam', name: 'Work Horse', levels: [{ min: 95, level: 'Gold' }, { min: 85, level: 'Silver' }, { min: 75, level: 'Bronze' }] },
    { attr: 'speed', name: 'Lightning Launch', levels: [{ min: 88, level: 'Hall of Fame' }, { min: 78, level: 'Gold' }, { min: 68, level: 'Silver' }, { min: 58, level: 'Bronze' }] },
    { attr: 'hustle', name: 'Hustler', levels: [{ min: 90, level: 'Hall of Fame' }, { min: 80, level: 'Gold' }, { min: 70, level: 'Silver' }, { min: 60, level: 'Bronze' }] },
  ];

  for (const bt of badgeThresholds) {
    const val = raw[bt.attr];
    if (val === null || val === undefined) continue;
    for (const lvl of bt.levels) {
      if (val >= lvl.min) {
        badges.push({ name: bt.name, level: lvl.level, category: getBadgeCategory(bt.name) });
        break;
      }
    }
  }

  return badges;
}

function getBadgeCategory(name) {
  const categories = {
    'Posterizer': 'Finishing',
    'Giant Slayer': 'Finishing',
    'Limitless Range': 'Shooting',
    'Dead Eye': 'Shooting',
    'Handles for Days': 'Playmaking',
    'Speed Booster': 'Playmaking',
    'Dimer': 'Playmaking',
    'Floor General': 'Playmaking',
    'Interceptor': 'Defense',
    'Anchor': 'Defense',
    'Post Lockdown': 'Defense',
    'Clamps': 'Defense',
    'Rebound Chaser': 'Rebounding',
    'Boxout Beast': 'Rebounding',
    'Dream Shake': 'Post Moves',
    'Work Horse': 'Physical',
    'Lightning Launch': 'Physical',
    'Hustler': 'Physical',
  };
  return categories[name] || 'General';
}

function calculateTendencies(raw) {
  const norm = (val, min, max) => {
    if (val === null || val === undefined) return 50;
    return Math.round(Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100)));
  };

  const mid = raw.mid ?? 50;
  const three = raw['3pt'] ?? 50;
  const shotiq = raw.shotiq ?? 50;
  const ball = raw.ball ?? 50;
  const spdball = raw.spdball ?? 50;
  const dunk = raw.dunk ?? 50;
  const pass = raw.pass ?? 50;
  const vision = raw.vision ?? 50;
  const passiq = raw.passiq ?? 50;
  const phook = raw.phook ?? 50;
  const pfade = raw.pfade ?? 50;
  const postc = raw.postc ?? 50;
  const foul = raw.foul ?? 50;
  const speed = raw.speed ?? 50;
  const layup = raw.layup ?? 50;
  const close = raw.close ?? 50;
  const idef = raw.idef ?? 50;

  const shotTendency = Math.round((mid * 0.3 + three * 0.3 + close * 0.2 + shotiq * 0.2));
  const threePointTendency = Math.round((three * 0.6 + shotiq * 0.2 + mid * 0.2));
  const driveTendency = Math.round((spdball * 0.35 + speed * 0.25 + ball * 0.2 + dunk * 0.15 + layup * 0.05));
  const passTendency = Math.round((pass * 0.35 + vision * 0.35 + passiq * 0.30));
  const postTendency = Math.round((phook * 0.35 + pfade * 0.30 + postc * 0.25 + idef * 0.10));
  const isolationTendency = Math.round((ball * 0.40 + shotiq * 0.25 + spdball * 0.20 + speed * 0.15));
  const pickAndRollTendency = Math.round((passiq * 0.30 + ball * 0.25 + spdball * 0.20 + close * 0.15 + mid * 0.10));
  const foulTendency = Math.round(norm(foul, 25, 99));

  return {
    shotTendency: Math.min(100, Math.max(0, shotTendency)),
    threePointTendency: Math.min(100, Math.max(0, threePointTendency)),
    driveTendency: Math.min(100, Math.max(0, driveTendency)),
    passTendency: Math.min(100, Math.max(0, passTendency)),
    postTendency: Math.min(100, Math.max(0, postTendency)),
    isolationTendency: Math.min(100, Math.max(0, isolationTendency)),
    pickAndRollTendency: Math.min(100, Math.max(0, pickAndRollTendency)),
    foulTendency: Math.min(100, Math.max(0, foulTendency)),
  };
}

function buildMinPlayer(player) {
  return {
    playerId: player.playerId,
    fullName: player.fullName,
    position: player.position,
    overall: player.overall,
    potential: player.potential,
    age: player.age,
    heightInches: player.heightInches,
    weight: player.weight,
    team: player.team,
    attributes: player.attributes,
    badges: player.badges.map(b => ({ name: b.name, level: b.level })),
    tendencies: player.tendencies,
  };
}

function deduplicate(players) {
  const seen = new Map();
  for (const player of players) {
    const key = `${player.firstName}|${player.lastName}`.toLowerCase();
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (player.overall > existing.overall) {
        seen.set(key, player);
      }
    } else {
      seen.set(key, player);
    }
  }
  return Array.from(seen.values());
}

function partialSave(players, batchNum) {
  const tempFile = path.join(__dirname, `nba_players_partial_${batchNum}.json`);
  fs.writeFileSync(tempFile, JSON.stringify({
    version: '2026',
    generatedAt: new Date().toISOString(),
    playerCount: players.length,
    players,
  }, null, 2), 'utf-8');
  console.log(`[Save] Partial save #${batchNum}: ${players.length} players -> ${tempFile}`);
}

function cleanPartialSaves() {
  const files = fs.readdirSync(__dirname).filter(f => f.startsWith('nba_players_partial_'));
  for (const f of files) {
    fs.unlinkSync(path.join(__dirname, f));
  }
}

async function main() {
  console.log('=== NBA2KLab Player Database Builder ===');
  console.log('Version: 2026');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const cached = loadCache();
  let rawPlayers;

  if (cached && Array.isArray(cached) && cached.length > 0) {
    console.log('[Source] Using cached data from NBA2KLab');
    rawPlayers = cached;
  } else {
    console.log('[Source] Fetching from NBA2KLab...');
    rawPlayers = await fetchWithRetry(NBA2KLAB_ROSTER_URL);
    if (!rawPlayers || rawPlayers.length === 0) {
      console.error('[Fatal] Failed to fetch player data from all sources');
      process.exit(1);
    }
    saveCache(rawPlayers);
  }

  console.log(`[Process] Raw players received: ${rawPlayers.length}`);
  console.log('[Process] Mapping players...');

  const mappedPlayers = rawPlayers.map(p => mapRawPlayer(p));
  const uniquePlayers = deduplicate(mappedPlayers);

  console.log(`[Process] After deduplication: ${uniquePlayers.length} players`);

  uniquePlayers.sort((a, b) => (b.overall || 0) - (a.overall || 0));

  const fullOutput = {
    version: '2026',
    generatedAt: new Date().toISOString(),
    playerCount: uniquePlayers.length,
    source: 'NBA2KLab (nba2klab.com)',
    season: 'NBA 2K26',
    players: uniquePlayers,
  };

  const minOutput = {
    version: '2026',
    generatedAt: new Date().toISOString(),
    playerCount: uniquePlayers.length,
    players: uniquePlayers.map(p => buildMinPlayer(p)),
  };

  console.log('[Save] Writing nba_players.json...');
  fs.writeFileSync(
    path.join(__dirname, 'nba_players.json'),
    JSON.stringify(fullOutput, null, 2),
    'utf-8'
  );

  console.log('[Save] Writing nba_players_min.json...');
  fs.writeFileSync(
    path.join(__dirname, 'nba_players_min.json'),
    JSON.stringify(minOutput, null, 2),
    'utf-8'
  );

  cleanPartialSaves();

  console.log('');
  console.log('=== Build Complete ===');
  console.log(`Players: ${uniquePlayers.length}`);
  console.log(`Full: nba_players.json (${formatBytes(fs.statSync(path.join(__dirname, 'nba_players.json')).size)})`);
  console.log(`Min:  nba_players_min.json (${formatBytes(fs.statSync(path.join(__dirname, 'nba_players_min.json')).size)})`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

main().catch(err => {
  console.error('[Fatal] Unhandled error:', err);
  process.exit(1);
});
