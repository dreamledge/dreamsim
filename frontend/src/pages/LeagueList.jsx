import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol } from '../lib/firestore';

export default function LeagueList() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const allLeaguesSnap = await getDocs(collection(db, 'leagues'));
      const userTeamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const userLeagueIds = new Set(userTeamSnap.docs.map(d => d.data().leagueId));
      const leagues = allLeaguesSnap.docs
        .filter(d => userLeagueIds.has(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
      setLeagues(leagues);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Leagues</h2>
        <button onClick={() => navigate('/leagues/create')} className="bg-[#e94560] text-white px-4 py-2 rounded-lg text-sm font-semibold">+ Create</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>
      ) : leagues.length === 0 ? (
        <div className="bg-[#16213e] rounded-xl p-6 text-center">
          <p className="text-gray-500">No leagues yet. Create or join one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <Link key={league.id} to={`/leagues/${league.id}`} className="bg-[#16213e] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c2a4a] transition block">
              <div>
                <h3 className="font-semibold">{league.name}</h3>
                <p className="text-xs text-gray-500">{league.description?.slice(0, 60)}</p>
                <p className="text-xs text-gray-500 mt-1">Season {league.currentSeason || 1}</p>
              </div>
              <span className="text-[#e94560]">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
