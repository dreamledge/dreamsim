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

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;
  if (!season) return <p className="text-gray-500">Season not found</p>;

  const completed = games.filter(g => g.isCompleted);
  const upcoming = games.filter(g => !g.isCompleted);

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-xl p-4">
        <h2 className="text-xl font-bold">Season {season.seasonNumber}</h2>
        <p className="text-gray-500 text-sm">Week {season.currentWeek}/{season.totalWeeks} · {season.status}</p>
      </div>

      {completed.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-3">Completed Games ({completed.length})</h3>
          <div className="space-y-2">
            {completed.slice(-10).reverse().map(game => (
              <div key={game.id} className="bg-[#1a1a2e] rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex-1 text-right">
                    <span className={game.homeScore > game.awayScore ? 'font-bold text-green-400' : 'text-gray-400'}>{teams[game.homeTeamId] || 'Home'}</span>
                  </div>
                  <div className="px-3 text-center">
                    <span className="font-bold text-lg">{game.homeScore}</span>
                    <span className="text-gray-500 mx-1">-</span>
                    <span className="font-bold text-lg">{game.awayScore}</span>
                  </div>
                  <div className="flex-1">
                    <span className={game.awayScore > game.homeScore ? 'font-bold text-green-400' : 'text-gray-400'}>{teams[game.awayTeamId] || 'Away'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">Week {game.week}{game.isPlayoff ? ' · Playoffs' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-3">Upcoming Games</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 10).map(game => (
              <div key={game.id} className="bg-[#1a1a2e] rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{teams[game.homeTeamId] || 'Home'}</span>
                  <span className="text-gray-500">VS</span>
                  <span>{teams[game.awayTeamId] || 'Away'}</span>
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">Week {game.week}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {season.status === 'completed' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
          <span className="text-4xl">🏆</span>
          <h3 className="font-bold mt-2">Season {season.seasonNumber} Complete!</h3>
        </div>
      )}
    </div>
  );
}
