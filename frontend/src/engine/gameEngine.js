import { uid } from '../lib/firestore';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

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

export function simulateGame(homePlayers, awayPlayers) {
  const homeRating = calculateTeamRating(homePlayers);
  const awayRating = calculateTeamRating(awayPlayers);
  const homeAdvantage = 3;
  const variance = () => Math.floor(Math.random() * 20 - 10);
  const homeScore = Math.max(60, Math.round(homeRating * 1.5 + homeAdvantage + variance()));
  const awayScore = Math.max(60, Math.round(awayRating * 1.5 + variance()));
  const homeWon = homeScore > awayScore;

  const simulateStats = (players, teamScore, isWinner) => players.map(p => ({
    playerId: p.id,
    teamId: p.teamId,
    points: Math.max(0, Math.min(Math.round(teamScore / players.length * (0.7 + Math.random() * 0.6)), 60)),
    rebounds: Math.round(2 + Math.random() * 10 * (p.rebounding || 50) / 70),
    assists: Math.round(1 + Math.random() * 8 * (p.playmaking || 50) / 70),
    steals: Math.round(Math.random() * 3 * (p.defense || 50) / 60),
    blocks: Math.round(Math.random() * 3 * (p.defense || 50) / 70),
    turnovers: Math.round(Math.random() * 4),
    fouls: Math.round(Math.random() * 4),
    minutes: 20 + Math.floor(Math.random() * 20),
    fgMade: 0, fgAttempted: 0, threeMade: 0, threeAttempted: 0, ftMade: 0, ftAttempted: 0,
  }));

  return {
    homeScore, awayScore, homeWon,
    homeStats: simulateStats(homePlayers, homeScore, homeWon),
    awayStats: simulateStats(awayPlayers, awayScore, !homeWon),
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
