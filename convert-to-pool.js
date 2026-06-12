const fs = require('fs');
const path = require('path');

const NBA_TEAMS = [
  { id: 1, name: 'Hawks', fullName: 'Atlanta Hawks', abbr: 'ATL', conf: 'East' },
  { id: 2, name: 'Celtics', fullName: 'Boston Celtics', abbr: 'BOS', conf: 'East' },
  { id: 3, name: 'Nets', fullName: 'Brooklyn Nets', abbr: 'BKN', conf: 'East' },
  { id: 4, name: 'Hornets', fullName: 'Charlotte Hornets', abbr: 'CHA', conf: 'East' },
  { id: 5, name: 'Bulls', fullName: 'Chicago Bulls', abbr: 'CHI', conf: 'East' },
  { id: 6, name: 'Cavaliers', fullName: 'Cleveland Cavaliers', abbr: 'CLE', conf: 'East' },
  { id: 7, name: 'Mavericks', fullName: 'Dallas Mavericks', abbr: 'DAL', conf: 'West' },
  { id: 8, name: 'Nuggets', fullName: 'Denver Nuggets', abbr: 'DEN', conf: 'West' },
  { id: 9, name: 'Pistons', fullName: 'Detroit Pistons', abbr: 'DET', conf: 'East' },
  { id: 10, name: 'Warriors', fullName: 'Golden State Warriors', abbr: 'GSW', conf: 'West' },
  { id: 11, name: 'Rockets', fullName: 'Houston Rockets', abbr: 'HOU', conf: 'West' },
  { id: 12, name: 'Pacers', fullName: 'Indiana Pacers', abbr: 'IND', conf: 'East' },
  { id: 13, name: 'Clippers', fullName: 'LA Clippers', abbr: 'LAC', conf: 'West' },
  { id: 14, name: 'Lakers', fullName: 'Los Angeles Lakers', abbr: 'LAL', conf: 'West' },
  { id: 15, name: 'Grizzlies', fullName: 'Memphis Grizzlies', abbr: 'MEM', conf: 'West' },
  { id: 16, name: 'Heat', fullName: 'Miami Heat', abbr: 'MIA', conf: 'East' },
  { id: 17, name: 'Bucks', fullName: 'Milwaukee Bucks', abbr: 'MIL', conf: 'East' },
  { id: 18, name: 'Timberwolves', fullName: 'Minnesota Timberwolves', abbr: 'MIN', conf: 'West' },
  { id: 19, name: 'Pelicans', fullName: 'New Orleans Pelicans', abbr: 'NOP', conf: 'West' },
  { id: 20, name: 'Knicks', fullName: 'New York Knicks', abbr: 'NYK', conf: 'East' },
  { id: 21, name: 'Thunder', fullName: 'Oklahoma City Thunder', abbr: 'OKC', conf: 'West' },
  { id: 22, name: 'Magic', fullName: 'Orlando Magic', abbr: 'ORL', conf: 'East' },
  { id: 23, name: '76ers', fullName: 'Philadelphia 76ers', abbr: 'PHI', conf: 'East' },
  { id: 24, name: 'Suns', fullName: 'Phoenix Suns', abbr: 'PHX', conf: 'West' },
  { id: 25, name: 'Trail Blazers', fullName: 'Portland Trail Blazers', abbr: 'POR', conf: 'West' },
  { id: 26, name: 'Kings', fullName: 'Sacramento Kings', abbr: 'SAC', conf: 'West' },
  { id: 27, name: 'Spurs', fullName: 'San Antonio Spurs', abbr: 'SAS', conf: 'East' },
  { id: 28, name: 'Raptors', fullName: 'Toronto Raptors', abbr: 'TOR', conf: 'East' },
  { id: 29, name: 'Jazz', fullName: 'Utah Jazz', abbr: 'UTA', conf: 'West' },
  { id: 30, name: 'Wizards', fullName: 'Washington Wizards', abbr: 'WAS', conf: 'East' },
];

const TEAM_NAME_TO_ID = {};
for (const t of NBA_TEAMS) {
  TEAM_NAME_TO_ID[t.fullName.toLowerCase()] = t.id;
}

const POSITION_ELIGIBILITY = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function attrToCategory(a, keys) {
  const vals = keys.map(k => a[k]).filter(v => v != null && typeof v === 'number');
  if (vals.length === 0) return 50;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

function mapPosition(primary, secondary) {
  if (secondary && POSITION_ELIGIBILITY[secondary]) return secondary;
  if (POSITION_ELIGIBILITY[primary]) return primary;
  return 'SF';
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function main() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'nba_players.json'), 'utf-8'));
  console.log(`Source: ${source.playerCount} players`);

  const mapped = [];

  for (const p of source.players) {
    const a = p.attributes;

    const offenseKeys = ['layup', 'drivingDunk', 'standingDunk', 'postHook', 'postFade', 'postControl', 'drawFoul', 'offensiveConsistency', 'shotIQ'];
    const offense = attrToCategory(a.offense, offenseKeys);

    const defenseKeys = ['block', 'steal', 'passPerception', 'interiorDefense', 'perimeterDefense', 'defensiveConsistency', 'helpDefenseIQ'];
    const defense = attrToCategory(a.defense, defenseKeys);

    const shootingKeys = ['threePoint', 'midRange', 'closeShot', 'freeThrow'];
    const shooting = attrToCategory(a.offense, shootingKeys);

    const playmakingKeys = ['ballHandle', 'speedWithBall', 'passAccuracy', 'passVision', 'passIQ'];
    const playmaking = attrToCategory(a.playmaking, playmakingKeys);

    const athleticismKeys = ['speed', 'strength', 'agility', 'vertical', 'stamina', 'hustle', 'durability'];
    const athleticism = attrToCategory(a.athleticism, athleticismKeys);

    const teamName = p.team || null;
    const nbaTeamId = teamName ? (TEAM_NAME_TO_ID[teamName.toLowerCase()] || null) : null;

    const primaryPos = p.position || 'SF';
    const primaryPosition = POSITION_ELIGIBILITY[primaryPos] ? primaryPos : 'SF';
    const canPlay = POSITION_ELIGIBILITY[primaryPosition] || POSITIONS;

    let rebounding;
    const oreb = a.defense && a.defense.offensiveRebound;
    const dreb = a.defense && a.defense.defensiveRebound;
    if (oreb != null && dreb != null) {
      rebounding = Math.round((oreb + dreb) / 2);
    } else {
      rebounding = 50;
    }

    const playerId = p.playerId;

    mapped.push({
      playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: primaryPosition,
      primaryPosition,
      canPlay,
      nbaTeam: null,
      teamName,
      age: p.age,
      height: p.heightInches || 78,
      weight: p.weight || 210,
      wingspan: p.wingspan,
      offense,
      defense,
      shooting,
      playmaking,
      rebounding,
      athleticism,
      overall: p.overall,
      potential: p.potential,
      injuryProne: rand(1, 30),
      morale: 50 + rand(0, 30),
      contractYears: rand(1, 5),
      contractValue: 500000 + rand(0, 5000000),
      statsPpg: null,
      statsRpg: null,
      statsApg: null,
      statsSpg: null,
      statsBpg: null,
      statsFgPct: null,
      statsThreePct: null,
      statsFtPct: null,
      statsGamesPlayed: 0,
      isInjured: false,
      injuryWeeks: 0,
      badges: p.badges ? p.badges.map(b => ({ name: b.name, level: b.level })) : [],
      tendencies: p.tendencies || null,
      twokAttributes: {
        ...a.offense,
        ...a.playmaking,
        ...a.defense,
        ...a.athleticism,
        ...a.mental,
      },
    });
  }

  mapped.sort((a, b) => (b.overall || 0) - (a.overall || 0));

  const output = {
    lastUpdated: new Date().toISOString(),
    count: mapped.length,
    source: 'NBA2KLab (nba2klab.com - NBA 2K26 ratings)',
    season: '2025-26',
    players: mapped,
  };

  const outPath = path.join(__dirname, 'frontend', 'src', 'engine', 'nbaPlayerPool.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  const stats = {
    total: mapped.length,
    avgOverall: Math.round(mapped.reduce((s, p) => s + p.overall, 0) / mapped.length),
    avgPotential: Math.round(mapped.reduce((s, p) => s + p.potential, 0) / mapped.length),
    avgAge: (mapped.reduce((s, p) => s + (p.age || 0), 0) / mapped.length).toFixed(1),
    teams: [...new Set(mapped.filter(p => p.teamName).map(p => p.teamName))].length,
    positions: {},
  };

  for (const p of mapped) {
    stats.positions[p.position] = (stats.positions[p.position] || 0) + 1;
  }

  const fileSize = fs.statSync(outPath).size;

  console.log(`\nWritten: ${outPath}`);
  console.log(`Size: ${(fileSize / 1024).toFixed(1)} KB`);
  console.log(`Players: ${stats.total}`);
  console.log(`Avg OVR: ${stats.avgOverall}`);
  console.log(`Avg POT: ${stats.avgPotential}`);
  console.log(`Avg Age: ${stats.avgAge}`);
  console.log(`Teams: ${stats.teams}`);
  console.log(`Positions: ${JSON.stringify(stats.positions)}`);
}

main();
