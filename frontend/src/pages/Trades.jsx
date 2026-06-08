import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol } from '../lib/firestore';

export default function Trades() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const leagueIds = [...new Set(teamSnap.docs.map(d => d.data().leagueId))];
      const lSnap = await getDocs(collection(db, 'leagues'));
      setLeagues(lSnap.docs.filter(d => leagueIds.includes(d.id)).map(d => ({ id: d.id, ...d.data() })));

      const tSnap = await getDocs(collection(db, 'trades'));
      const teamIds = new Set(teamSnap.docs.map(d => d.id));
      setTrades(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => teamIds.has(t.teamAId) || teamIds.has(t.teamBId)));
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Trades</h2>
        {leagues.length > 0 && (
          <button onClick={() => navigate(`/trades/${leagues[0].id}`)} className="bg-[#e94560] text-white px-4 py-2 rounded-lg text-sm font-semibold">New Trade</button>
        )}
      </div>

      {leagues.map(l => (
        <button key={l.id} onClick={() => navigate(`/trades/${l.id}`)} className="bg-[#16213e] px-3 py-2 rounded-lg text-sm mr-2 hover:bg-[#1c2a4a]">{l.name}</button>
      ))}

      <div className="bg-[#16213e] rounded-xl p-4">
        <h3 className="font-semibold mb-3">Recent Trades</h3>
        {trades.length === 0 ? (
          <p className="text-sm text-gray-500">No trades yet.</p>
        ) : (
          <div className="space-y-2">
            {trades.map(trade => (
              <div key={trade.id} className="bg-[#1a1a2e] rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{trade.teamAId?.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${trade.status === 'accepted' ? 'bg-green-500/20 text-green-400' : trade.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{trade.status}</span>
                  <span>{trade.teamBId?.slice(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
