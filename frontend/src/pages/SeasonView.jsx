import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export default function SeasonView() {
  const { leagueId, seasonId } = useParams();
  const [season, setSeason] = useState(null);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sSnap = await getDoc(doc(db, 'seasons', seasonId));
      if (!sSnap.exists()) { setLoading(false); return; }
      setSeason({ id: sSnap.id, ...sSnap.data() });

      const gSnap = await getDocs(collection(db, 'seasons', seasonId, 'games'));
      setGames(gSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.week - b.week));

      const tSnap = await getDocs(query(collection(db, 'teams'), where('leagueId', '==', leagueId)));
      const tMap = {};
      tSnap.docs.forEach(d => {
        const data = d.data();
        tMap[d.id] = {
          id: d.id,
          name: data.name || 'Unknown',
          abbreviation: data.abbreviation || data.name?.slice(0, 3).toUpperCase() || '???',
          primaryColor: data.primaryColor || '#ff7b35',
          secondaryColor: data.secondaryColor || '#e83a4b',
          wins: 0,
          losses: 0,
        };
      });
      setTeams(tMap);
      setLoading(false);
    };
    load();
  }, [seasonId, leagueId]);

  const weeks = useMemo(() => {
    const byWeek = {};
    for (const game of games) {
      if (!byWeek[game.week]) byWeek[game.week] = [];
      byWeek[game.week].push(game);
    }
    return Object.entries(byWeek).map(([week, weekGames]) => ({
      week: Number(week),
      games: weekGames,
      isPlayoff: weekGames.some(g => g.isPlayoff),
    })).sort((a, b) => b.week - a.week);
  }, [games]);

  useEffect(() => {
    if (games.length === 0 || Object.keys(teams).length === 0) return;
    const updated = { ...teams };
    for (const game of games) {
      const home = updated[game.homeTeamId];
      const away = updated[game.awayTeamId];
      if (!home || !away) continue;
      if (game.homeScore > game.awayScore) { home.wins++; away.losses++; }
      else if (game.awayScore > game.homeScore) { away.wins++; home.losses++; }
    }
    setTeams(updated);
  }, [games]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );
  if (!season) return <p className="text-[var(--text-tertiary)]">Season not found</p>;

  const currentWeek = season.currentWeek;
  const getTeam = (id) => teams[id] || { name: '???', abbreviation: '???', primaryColor: '#666', wins: 0, losses: 0 };

  return (
    <div className="space-y-4 stagger">
      <div className="glass-card p-4 animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">Schedule</h2>
        <p className="text-[var(--text-secondary)] text-sm">Week {currentWeek}/{season.totalWeeks} · <span className="capitalize">{season.status}</span></p>
      </div>

      {games.length === 0 && (
        <div className="glass-card p-8 text-center animate-scale-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-2xl mb-4 shadow-lg shadow-[#ff7b35]/20">🏀</div>
          <h3 className="font-display text-xl tracking-wider">Schedule TBD</h3>
          <p className="text-[var(--text-secondary)] text-sm mt-1">No games have been scheduled yet. The commissioner needs to start the season.</p>
        </div>
      )}

      {weeks.map(({ week, games: weekGames, isPlayoff }) => (
        <div key={week} className="glass-card p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg tracking-wider">
              Week {week}
              {week === currentWeek && <span className="text-xs font-medium text-[var(--accent-orange)] ml-2">CURRENT</span>}
            </h3>
            {isPlayoff && (
              <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">PLAYOFFS</span>
            )}
          </div>
          <div className="space-y-1.5">
            {weekGames.map((game) => {
              const home = getTeam(game.homeTeamId);
              const away = getTeam(game.awayTeamId);
              const homeWon = game.homeScore > game.awayScore;
              const awayWon = game.awayScore > game.homeScore;
              return (
                <div key={game.id}
                  className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="text-xs text-[var(--text-tertiary)] font-mono w-8 text-right flex-shrink-0">{away.wins}-{away.losses}</span>
                    <span className={`text-sm font-semibold truncate ${awayWon ? 'text-[var(--accent-teal)]' : 'text-[var(--text-secondary)]'}`}>{away.abbreviation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-card)] rounded-lg flex-shrink-0 min-w-[72px] justify-center">
                    <span className={`font-display text-lg tabular-nums ${homeWon ? 'text-[var(--accent-teal)]' : 'text-[var(--text-tertiary)]'}`}>{game.homeScore}</span>
                    <span className="text-[var(--text-tertiary)] text-xs font-bold">-</span>
                    <span className={`font-display text-lg tabular-nums ${awayWon ? 'text-[var(--accent-teal)]' : 'text-[var(--text-tertiary)]'}`}>{game.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-sm font-semibold truncate ${homeWon ? 'text-[var(--accent-teal)]' : 'text-[var(--text-secondary)]'}`}>{home.abbreviation}</span>
                    <span className="text-xs text-[var(--text-tertiary)] font-mono w-8 flex-shrink-0">{home.wins}-{home.losses}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {season.status === 'completed' && (
        <div className="glass-card p-6 text-center border border-yellow-500/20 animate-scale-in">
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="font-display text-2xl tracking-wider">Season {season.seasonNumber} Complete!</h3>
        </div>
      )}
    </div>
  );
}
