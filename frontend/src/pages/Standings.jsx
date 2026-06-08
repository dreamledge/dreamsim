import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export default function Standings() {
  const { id } = useParams();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const tSnap = await getDocs(query(collection(db, 'teams'), where('leagueId', '==', id)));
      setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.wins || 0) - (a.wins || 0)));
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Standings</h2>
      <div className="bg-[#16213e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 text-xs text-gray-500 px-4 py-2 border-b border-gray-700">
          <span className="col-span-2">Team</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-right">PCT</span>
        </div>
        <div className="divide-y divide-gray-800">
          {teams.map((team, i) => (
            <Link key={team.id} to={`/teams/${team.id}`} className="grid grid-cols-5 items-center px-4 py-3 text-sm hover:bg-[#1a1a2e]">
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-gray-500 w-5">{i + 1}</span>
                <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: team.primaryColor || '#1a1a2e' }}>
                  {team.abbreviation || team.name?.slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{team.name}</span>
              </div>
              <span className="text-center font-medium">{team.wins || 0}</span>
              <span className="text-center text-gray-400">{team.losses || 0}</span>
              <span className="text-right text-gray-400">
                {((team.wins || 0) + (team.losses || 0)) > 0 ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(1) : '-'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
