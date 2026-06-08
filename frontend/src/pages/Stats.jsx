import { useState, useEffect } from 'react';
import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, teamPlayersCol } from '../lib/firestore';

export default function Stats() {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const allPlayers = [];
      for (const tDoc of teamSnap.docs) {
        const pSnap = await getDocs(teamPlayersCol(tDoc.id));
        pSnap.docs.forEach(d => {
          const p = d.data();
          allPlayers.push({ ...p, teamName: tDoc.data().name });
        });
      }
      allPlayers.sort((a, b) => (b.statsPpg || 0) - (a.statsPpg || 0));
      setLeaders(allPlayers.slice(0, 20));
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📊 Stats</h2>

      {leaders.length > 0 ? (
        <>
          <div className="bg-[#16213e] rounded-xl p-4">
            <h3 className="font-semibold mb-3">🏀 League Leaders</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs text-gray-500 px-2 pb-1 border-b border-gray-700">
                <span className="col-span-2">Player</span><span className="text-right">PPG</span><span className="text-right">Team</span>
              </div>
              {leaders.slice(0, 15).map((p, i) => (
                <div key={p.id} className="grid grid-cols-4 items-center px-2 py-1.5 text-sm hover:bg-[#1a1a2e] rounded">
                  <span className="col-span-2 flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                    <span>{p.firstName} {p.lastName}</span>
                    <span className="text-xs text-gray-500">{p.position}</span>
                  </span>
                  <span className="text-right font-medium">{(p.statsPpg || 0).toFixed(1)}</span>
                  <span className="text-right text-xs text-gray-500">{p.teamName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#16213e] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-2">Rebound Leaders</h4>
              <div className="space-y-1 text-sm">
                {[...leaders].sort((a, b) => (b.statsRpg || 0) - (a.statsRpg || 0)).slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between"><span className="text-gray-400">{p.firstName} {p.lastName}</span><span>{(p.statsRpg || 0).toFixed(1)}</span></div>
                ))}
              </div>
            </div>
            <div className="bg-[#16213e] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-2">Assist Leaders</h4>
              <div className="space-y-1 text-sm">
                {[...leaders].sort((a, b) => (b.statsApg || 0) - (a.statsApg || 0)).slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between"><span className="text-gray-400">{p.firstName} {p.lastName}</span><span>{(p.statsApg || 0).toFixed(1)}</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[#16213e] rounded-xl p-6 text-center">
          <p className="text-gray-500">No stats available yet. Start simulating games!</p>
        </div>
      )}
    </div>
  );
}
