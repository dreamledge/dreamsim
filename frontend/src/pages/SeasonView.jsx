import { useState, useEffect } from 'react';
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
      if (!sSnap.exists()) return;
      setSeason({ id: sSnap.id, ...sSnap.data() });

      const gSnap = await getDocs(collection(db, 'seasons', seasonId, 'games'));
      setGames(gSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.week - b.week));

      const tSnap = await getDocs(query(collection(db, 'teams'), where('leagueId', '==', leagueId)));
      const tMap = {};
      tSnap.docs.forEach(d => { tMap[d.id] = d.data().name || 'Unknown'; });
      setTeams(tMap);
      setLoading(false);
    };
    load();
  }, [seasonId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );
  if (!season) return <p className="text-[var(--text-tertiary)]">Season not found</p>;

  const completed = games.filter(g => g.isCompleted);
  const upcoming = games.filter(g => !g.isCompleted);

  return (
    <div className="space-y-4 stagger">
      <div className="glass-card p-4 animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">Season {season.seasonNumber}</h2>
        <p className="text-[var(--text-secondary)] text-sm">Week {season.currentWeek}/{season.totalWeeks} · <span className="capitalize">{season.status}</span></p>
      </div>

      {completed.length > 0 && (
        <div className="glass-card p-4 animate-fade-up">
          <h3 className="font-display text-lg tracking-wider mb-3">Completed Games ({completed.length})</h3>
          <div className="space-y-2">
            {completed.slice(-10).reverse().map((game, i) => (
              <div key={game.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:bg-[var(--bg-tertiary)] transition-colors" style={{animationDelay: `${i * 0.04}s`}}>
                <div className="flex items-center text-sm">
                  <div className="flex-1 text-right pr-2">
                    <span className={game.homeScore > game.awayScore ? 'font-bold text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'}>{teams[game.homeTeamId] || 'Home'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-card)] rounded-lg">
                    <span className={`font-display text-xl ${game.homeScore > game.awayScore ? 'text-[var(--accent-green)]' : 'text-[var(--text-tertiary)]'}`}>{game.homeScore}</span>
                    <span className="text-[var(--text-tertiary)] text-xs">-</span>
                    <span className={`font-display text-xl ${game.awayScore > game.homeScore ? 'text-[var(--accent-green)]' : 'text-[var(--text-tertiary)]'}`}>{game.awayScore}</span>
                  </div>
                  <div className="flex-1 pl-2">
                    <span className={game.awayScore > game.homeScore ? 'font-bold text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'}>{teams[game.awayTeamId] || 'Away'}</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] text-center mt-1.5">W{game.week}{game.isPlayoff ? ' · Playoffs' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="glass-card p-4 animate-fade-up">
          <h3 className="font-display text-lg tracking-wider mb-3">Upcoming Games</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 10).map((game, i) => (
              <div key={game.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3" style={{animationDelay: `${i * 0.04}s`}}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex-1 text-right pr-2">{teams[game.homeTeamId] || 'Home'}</span>
                  <span className="text-[var(--text-tertiary)] text-xs font-semibold px-3 py-1 bg-[var(--bg-card)] rounded-lg">VS</span>
                  <span className="flex-1 pl-2">{teams[game.awayTeamId] || 'Away'}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] text-center mt-1.5">Week {game.week}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {season.status === 'completed' && (
        <div className="glass-card p-6 text-center border border-yellow-500/20 animate-scale-in">
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="font-display text-2xl tracking-wider">Season {season.seasonNumber} Complete!</h3>
        </div>
      )}
    </div>
  );
}
