import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { query, where, orderBy, getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { leaguesCol, leagueDoc, leagueNewsCol, teamsCol } from '../lib/firestore';

export default function Home() {
  const { user } = useAuth();
  const [userLeagues, setUserLeagues] = useState([]);
  const [newsMap, setNewsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const teamsSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const leagueIds = [...new Set(teamsSnap.docs.map(d => d.data().leagueId))];
      const leagues = [];
      for (const lid of leagueIds) {
        const snap = await getDoc(leagueDoc(lid));
        if (snap.exists()) leagues.push({ id: snap.id, ...snap.data() });
      }
      setUserLeagues(leagues);

      const nm = {};
      for (const l of leagues.slice(0, 3)) {
        const newsSnap = await getDocs(query(leagueNewsCol(l.id), orderBy('createdAt', 'desc'), limit(3)));
        nm[l.id] = newsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setNewsMap(nm);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Welcome{user?.displayName ? `, ${user.displayName}` : ''}</h2>
          <p className="text-gray-500 text-sm">{userLeagues.length} active league{userLeagues.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/leagues/create')} className="bg-[#e94560] text-white px-4 py-2 rounded-lg text-sm font-semibold">+ New League</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>
      ) : userLeagues.length === 0 ? (
        <div className="bg-[#16213e] rounded-xl p-6 text-center">
          <span className="text-4xl">🏀</span>
          <h3 className="text-lg font-semibold mt-3">Welcome to Dynasty League</h3>
          <p className="text-gray-500 text-sm mt-1">Create or join a league to get started</p>
          <div className="flex gap-3 mt-4 justify-center">
            <Link to="/leagues/create" className="bg-[#e94560] text-white px-4 py-2 rounded-lg text-sm font-semibold">Create League</Link>
            <Link to="/leagues" className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm">Join League</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Your Leagues</h3>
            {userLeagues.map(league => (
              <Link key={league.id} to={`/leagues/${league.id}`} className="bg-[#16213e] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c2a4a] transition block">
                <div>
                  <h4 className="font-semibold">{league.name}</h4>
                  <p className="text-xs text-gray-500">Season {league.currentSeason || 1}</p>
                </div>
                <span className="text-[#e94560]">→</span>
              </Link>
            ))}
          </div>

          {Object.entries(newsMap).filter(([,v]) => v.length > 0).map(([leagueId, news]) => (
            <div key={leagueId} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Latest News</h3>
              {news.map((item, i) => (
                <div key={i} className="bg-[#16213e] rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{item.storyType === 'championship' ? '🏆' : item.storyType === 'trade' ? '🤝' : '📰'}</span>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.body?.slice(0, 80)}...</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
