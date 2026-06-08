export function generateTradeAnalysis(teamA, teamB, teamAPlayers, teamBPlayers) {
  const aValue = teamAPlayers.reduce((sum, p) => sum + p.overall, 0);
  const bValue = teamBPlayers.reduce((sum, p) => sum + p.overall, 0);
  const diff = aValue - bValue;
  const aAvg = teamAPlayers.length > 0 ? Math.round(aValue / teamAPlayers.length) : 0;
  const bAvg = teamBPlayers.length > 0 ? Math.round(bValue / teamBPlayers.length) : 0;

  let verdict, explanation, score;
  if (Math.abs(diff) < 5) {
    verdict = 'Fair Trade';
    explanation = 'Both teams receive comparable value.';
    score = 50;
  } else if (diff > 0) {
    verdict = 'Steal';
    explanation = `${teamA.name} gets the better end of this deal.`;
    score = 70 + Math.min(diff, 25);
  } else {
    verdict = 'Bad Deal';
    explanation = `${teamB.name} comes out ahead.`;
    score = 30 - Math.min(Math.abs(diff), 20);
  }

  return {
    verdict, score: Math.max(0, Math.min(99, score)), explanation,
    details: {
      teamAAvgRating: aAvg, teamBAvgRating: bAvg,
      teamATotalValue: aValue, teamBTotalValue: bValue,
      difference: Math.abs(diff),
    },
  };
}

export function generateDraftRecommendation(availablePlayers, roster) {
  const posCounts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  roster.forEach(p => { if (posCounts[p.position] !== undefined) posCounts[p.position]++; });
  const needs = Object.entries(posCounts).sort(([,a], [,b]) => a - b).map(([pos]) => pos);
  const primaryNeed = needs[0];

  const scored = availablePlayers.map(p => ({
    player: p,
    score: p.overall + (p.position === primaryNeed ? 5 : 0) + (p.potential > 75 ? 3 : 0) - (p.overall < 60 ? 5 : 0),
  })).sort((a, b) => b.score - a.score);

  return {
    topPick: scored[0]?.player || null,
    recommendations: scored.slice(0, 5).map(r => ({
      player: r.player,
      fitScore: Math.round(r.score),
      reason: r.player.position === primaryNeed
        ? 'Fills a critical positional need'
        : r.player.potential > 75 ? 'High upside potential' : 'Best player available',
    })),
    teamNeeds: { positions: needs, primaryNeed, rosterComposition: posCounts },
  };
}

export function generateLineupOptimization(players) {
  const groups = { PG: [], SG: [], SF: [], PF: [], C: [] };
  players.forEach(p => { if (groups[p.position]) groups[p.position].push(p); });
  const used = new Set();
  const starters = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => {
    const available = groups[pos].filter(p => !used.has(p.id)).sort((a, b) => b.overall - a.overall);
    if (available.length > 0) { used.add(available[0].id); return available[0]; }
    return null;
  }).filter(Boolean);
  const bench = players.filter(p => !used.has(p.id)).sort((a, b) => b.overall - a.overall);
  return {
    starters: starters.map((p, i) => ({ ...p, lineupPosition: i })),
    bench: bench.slice(0, 5),
    rating: starters.length > 0 ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : 0,
    suggestions: starters.length < 5 ? ['Roster incomplete. Draft more players.'] : [],
  };
}

export function generateInjuryRiskAnalysis(player) {
  const risk = Math.min(99, player.injuryProne + Math.floor(Math.random() * 20));
  let riskLevel, recommendation;
  if (risk < 20) { riskLevel = 'Low'; recommendation = 'No concerns.'; }
  else if (risk < 40) { riskLevel = 'Moderate'; recommendation = 'Monitor minutes.'; }
  else if (risk < 60) { riskLevel = 'Elevated'; recommendation = 'Limit to 30 min/game.'; }
  else { riskLevel = 'High'; recommendation = 'Manage workload carefully.'; }
  return {
    playerName: `${player.firstName} ${player.lastName}`,
    riskLevel, riskScore: risk, recommendation,
    factors: [player.age > 30 ? 'Age factor' : 'Young player', player.injuryProne > 30 ? 'Injury history' : 'Clean history'],
  };
}

export function generateScoutingReport(opponent, opponentPlayers) {
  const sorted = [...opponentPlayers].sort((a, b) => b.overall - a.overall);
  const keyPlayers = sorted.slice(0, 3);
  return {
    opponentName: opponent.name,
    overallRating: opponentPlayers.length > 0 ? Math.round(opponentPlayers.reduce((s, p) => s + p.overall, 0) / opponentPlayers.length) : 0,
    keyPlayers: keyPlayers.map(p => ({
      name: `${p.firstName} ${p.lastName}`, position: p.position, rating: p.overall,
      strength: p.offense > p.defense ? 'Offensive threat' : 'Defensive anchor',
    })),
    strategy: keyPlayers[0] ? `Focus on ${keyPlayers[0].firstName} ${keyPlayers[0].lastName}` : 'No clear star',
  };
}

export function generateSeasonPrediction(teams) {
  return teams.map(t => {
    const rating = t.players?.length > 0
      ? Math.round(t.players.reduce((s, p) => s + p.overall, 0) / t.players.length)
      : 50;
    const projectedWins = Math.min(82, Math.max(10, Math.round(rating * 0.8 + Math.random() * 10)));
    const playoffOdds = Math.min(99, Math.round((rating - 40) * 2.5));
    return {
      teamId: t.id, teamName: t.name,
      projectedWins, projectedLosses: 82 - projectedWins,
      playoffOdds, championshipOdds: Math.round(playoffOdds * 0.3),
    };
  }).sort((a, b) => b.projectedWins - a.projectedWins);
}

export function generateStory(teams, storyType) {
  const templates = {
    trade: { titles: ['Blockbuster Trade!', 'Shocking Deal!', 'Trade Deadline Shakeup!'], bodies: ['A major trade has been completed that could reshape the playoff picture.', 'The trade market is heating up with this surprising move.'] },
    rivalry: { titles: ['Rivalry Heats Up!', 'Bad Blood!', 'This Rivalry is Personal'], bodies: ['These two teams are ready to settle the score in what promises to be an intense matchup.', 'What started as competition has turned into a full-blown rivalry.'] },
    mvp: { titles: ['MVP Watch: Frontrunner Emerges', 'MVP Campaign Heating Up', 'Is This the MVP?'], bodies: ['With spectacular performances all season, this player is making a strong MVP case.', 'The MVP race is tightening as one player separates from the pack.'] },
    championship: { titles: ['Championship Glory!', 'History Made!', 'The Dynasty Begins!'], bodies: ['After an incredible season, a new champion has been crowned.', 'The confetti falls as the champions celebrate their hard-earned victory.'] },
    general: { titles: ['League News Update', 'Around the League', 'Breaking Developments'], bodies: ['Teams are positioning themselves for playoff runs as the season progresses.', 'The league continues to evolve as teams make moves and players step up.'] },
  };
  const t = templates[storyType] || templates.general;
  const title = t.titles[Math.floor(Math.random() * t.titles.length)];
  const body = t.bodies[Math.floor(Math.random() * t.bodies.length)];

  if (teams && teams.length > 0) {
    const randomTeam = teams[Math.floor(Math.random() * teams.length)];
    return { title: title.replace(/teams/i, randomTeam.name), body: body.replace(/teams/i, randomTeam.name), storyType, teamId: randomTeam.id };
  }
  return { title, body, storyType };
}
