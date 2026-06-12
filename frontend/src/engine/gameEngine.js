import { uid } from '../lib/firestore';
import { draftNbaPlayers, ensureNbaPool, getNbaPlayerPool, getPoolSize } from './nbaPlayers';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const POSITION_ELIGIBILITY = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

export function getEligiblePositions(primaryPos) {
  return POSITION_ELIGIBILITY[primaryPos] || POSITIONS;
}

export function isEligibleForPosition(player, slotPosition) {
  return getEligiblePositions(player.primaryPosition || player.position).includes(slotPosition);
}

export function generateSchedule(teamIds) {
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
  const n = shuffled.length;
  const pairs = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    const home = shuffled[i];
    const away = shuffled[n - 1 - i];
    if (Math.random() > 0.5) {
      pairs.push({ home, away });
    } else {
      pairs.push({ home: away, away: home });
    }
  }
  return pairs;
}

export function calculateTeamRating(players) {
  if (!players || players.length === 0) return 50;
  return Math.round(players.reduce((s, p) => s + (p.overall || 50), 0) / players.length);
}

const REALISTIC_MINUTES = [36, 34, 32, 28, 26, 22, 18, 14, 10, 6];
const POSITION_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];

function pickStarters(players) {
  const used = new Set();
  return POSITION_SLOTS.map(slot => {
    const eligible = players
      .filter(p => !used.has(p.id) && isEligibleForPosition(p, slot))
      .sort((a, b) => (b.overall || 0) - (a.overall || 0));
    if (eligible.length > 0) { used.add(eligible[0].id); return eligible[0]; }
    return null;
  }).filter(Boolean);
}

function clampStat(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function simulateGame(homePlayers, awayPlayers) {
  const homeStarters = pickStarters(homePlayers);
  const awayStarters = pickStarters(awayPlayers);

  const allHome = [...homePlayers].sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 10);
  const allAway = [...awayPlayers].sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 10);

  const homeDefMap = {};
  const awayDefMap = {};
  for (let i = 0; i < Math.min(homeStarters.length, awayStarters.length); i++) {
    homeDefMap[homeStarters[i].id] = awayStarters[i];
    awayDefMap[awayStarters[i].id] = homeStarters[i];
  }

  function usageScore(p) {
    return (p.offense || 50) * 1.2 + (p.shooting || 50) * 0.8 + (p.playmaking || 50) * 0.5;
  }

  function calcPlayerStats(player, defender, isHome, players) {
    const minutes = (() => {
      const rank = players.indexOf(player);
      if (rank < 0) return 12;
      return REALISTIC_MINUTES[Math.min(rank, REALISTIC_MINUTES.length - 1)] + Math.floor(Math.random() * 6 - 3);
    })();

    const usage = usageScore(player) / 100;
    const defRating = defender ? (defender.defense || 50) / 100 : 0.35;
    const defPenalty = defRating * 0.4;

    const baseEff = (player.offense || 50) / 100 * 0.6 + (player.shooting || 50) / 100 * 0.25 + 0.15;
    let eff = Math.max(0.15, baseEff - defPenalty + (Math.random() * 0.12 - 0.06));
    const fga = clampStat(usage * minutes * 0.32 + (Math.random() * 4 - 2), 2, 35);
    const fgm = clampStat(fga * eff, 0, fga);

    const threeRate = (player.shooting || 50) / 150;
    const threeAtt = clampStat(fga * threeRate * (0.7 + Math.random() * 0.6), 0, 18);
    const threePct = ((player.shooting || 50) / 100 * 0.5 + 0.15) - defPenalty * 0.3;
    const threeMade = clampStat(threeAtt * Math.max(0.05, threePct), 0, threeAtt);

    const twoAtt = fga - threeAtt;
    const twoMade = fgm - threeMade;

    const ftRate = (player.offense || 50) / 180;
    const fta = clampStat(twoAtt * ftRate * (0.5 + Math.random() * 0.5), 0, 20);
    const ftPct = ((player.shooting || 50) / 100 * 0.3 + 0.55) + Math.random() * 0.1 - 0.05;
    const ftMade = clampStat(fta * Math.max(0.3, ftPct), 0, fta);

    const points = twoMade * 2 + threeMade * 3 + ftMade;

    const reboundRating = (player.rebounding || 50) / 100;
    const oppRebRating = defender ? (defender.rebounding || 50) / 100 : 0.3;
    const rebPct = Math.max(0.05, reboundRating - oppRebRating * 0.3 + 0.15 + Math.random() * 0.08 - 0.04);
    const teamRebounds = 38 + Math.floor(Math.random() * 12 - 6);
    const rebounds = clampStat(teamRebounds * rebPct * 1.6, 0, 25);

    const playPct = (player.playmaking || 50) / 100;
    const teamAssists = 18 + Math.floor(Math.random() * 12);
    const assists = clampStat(teamAssists * playPct * 0.7 + (Math.random() * 3 - 1.5), 0, 18);

    const defPct = (player.defense || 50) / 150;
    const athPct = (player.athleticism || 50) / 150;
    const steals = clampStat(defPct * 3.5 + athPct * 1.5 + Math.random() * 1.5, 0, 8);
    const blocks = clampStat(defPct * 1.5 + (player.rebounding || 50) / 200 + Math.random() * 1.5, 0, 8);

    const turnovers = clampStat(playPct * 3 + usage * 1.5 + Math.random() * 2, 0, 8);
    const fouls = clampStat(2 + Math.random() * 3, 0, 6);

    return {
      playerId: player.id,
      teamId: player.teamId,
      minutes: clampStat(minutes, 0, 48),
      points: clampStat(points, 0, 60),
      rebounds,
      assists,
      steals,
      blocks,
      turnovers,
      fouls,
      fgMade: clampStat(twoMade + threeMade, 0, fga),
      fgAttempted: clampStat(fga, 0, 40),
      threeMade: clampStat(threeMade, 0, threeAtt),
      threeAttempted: clampStat(threeAtt, 0, 20),
      ftMade: clampStat(ftMade, 0, fta),
      ftAttempted: clampStat(fta, 0, 22),
    };
  }

  const homeStats = allHome.map(p => calcPlayerStats(p, homeDefMap[p.id], true, allHome));
  const awayStats = allAway.map(p => calcPlayerStats(p, awayDefMap[p.id], false, allAway));

  const homeScore = clampStat(homeStats.reduce((s, p) => s + p.points, 0), 60, 140);
  const awayScore = clampStat(awayStats.reduce((s, p) => s + p.points, 0), 60, 140);

  return {
    homeScore,
    awayScore,
    homeWon: homeScore > awayScore,
    homeStats: homeStats.map(s => ({ ...s, points: s.points })),
    awayStats: awayStats.map(s => ({ ...s, points: s.points })),
  };
}

export function createPlayer(firstName, lastName, position, age) {
  const base = 40 + Math.floor(Math.random() * 35);
  const id = uid();
  const attrs = {
    offense: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 20))),
    defense: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 20) - 10)),
    shooting: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 25))),
    playmaking: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 20))),
    rebounding: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 20))),
    athleticism: Math.min(99, Math.max(20, base + Math.floor(Math.random() * 15))),
  };
  attrs.overall = Math.round((attrs.offense + attrs.defense + attrs.shooting + attrs.playmaking + attrs.rebounding + attrs.athleticism) / 6);

  return {
    id,
    firstName,
    lastName,
    position,
    primaryPosition: position,
    canPlay: getEligiblePositions(position),
    age: age || 19 + Math.floor(Math.random() * 7),
    height: 72 + Math.floor(Math.random() * 18),
    weight: 180 + Math.floor(Math.random() * 80),
    ...attrs,
    potential: Math.min(99, attrs.overall + 5 + Math.floor(Math.random() * 15)),
    injuryProne: Math.floor(Math.random() * 30),
    morale: 50 + Math.floor(Math.random() * 30),
    contractYears: 1 + Math.floor(Math.random() * 4),
    contractValue: 500000 + Math.floor(Math.random() * 5000000),
    statsPpg: 0, statsRpg: 0, statsApg: 0, statsSpg: 0, statsBpg: 0,
    statsFgPct: 0, statsThreePct: 0, statsFtPct: 0, statsGamesPlayed: 0,
    isInjured: false, injuryWeeks: 0,
  };
}

export function draftPlayers(count = 5) {
  const firstNames = ['Jaylen','Marcus','Devin','Trae','Zion','Ja','Luka','Giannis','Steph','KD','Kyrie','Jayson','Jimmy','Bam','Donovan','Shai','Anthony','LaMelo','Cade','Scottie','Tyrese','Jalen','Herb','Paolo','Keegan','Jaden','Austin','RJ','Victor','Chet'];
  const lastNames = ['Williams','Johnson','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Garcia','Robinson','Clark','Lewis','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Turner','Hill','Adams'];
  const players = [];
  for (let i = 0; i < count; i++) {
    const pos = POSITIONS[i % 5];
    players.push(createPlayer(
      firstNames[Math.floor(Math.random() * firstNames.length)],
      lastNames[Math.floor(Math.random() * lastNames.length)],
      pos, 19 + Math.floor(Math.random() * 5)
    ));
  }
  return players;
}

export { draftNbaPlayers, ensureNbaPool, getNbaPlayerPool, getPoolSize };
