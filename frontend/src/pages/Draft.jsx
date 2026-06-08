import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamDoc, teamPlayersCol } from '../lib/firestore';
import { draftPlayers } from '../engine/gameEngine';

export default function Draft() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userTeams, setUserTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const tSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      setUserTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [user]);

  const handleDraft = async () => {
    if (!selectedTeamId) return;
    setDrafting(true);
    try {
      const team = userTeams.find(t => t.id === selectedTeamId);
      const pSnap = await getDocs(teamPlayersCol(selectedTeamId));
      const existing = pSnap.docs.length;
      const needed = 15 - existing;
      if (needed <= 0) { alert('Roster is full (max 15)!'); setDrafting(false); return; }

      const count = Math.min(needed, 5);
      const newPlayers = draftPlayers(count);
      for (let i = 0; i < newPlayers.length; i++) {
        const p = newPlayers[i];
        const pId = uid();
        await setDoc(doc(teamPlayersCol(selectedTeamId), pId), {
          ...p, teamId: selectedTeamId, seasonId: team?.seasonId || 1,
          isStarter: existing + i < 5 ? 1 : 0,
          lineupPosition: existing + i < 5 ? existing + i : null,
        });
      }
      alert(`Drafted ${newPlayers.length} new players!`);
      navigate(`/teams/${selectedTeamId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">🏀 Player Draft</h2>
      <p className="text-gray-500 text-sm">Draft new players to fill out your roster</p>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>
      ) : userTeams.length === 0 ? (
        <div className="bg-[#16213e] rounded-xl p-6 text-center">
          <p className="text-gray-500">Create a team first</p>
          <Link to="/teams/create" className="text-[#e94560] text-sm mt-2 inline-block">Create Team →</Link>
        </div>
      ) : (
        <>
          <div className="bg-[#16213e] rounded-xl p-4">
            <select value={selectedTeamId || ''} onChange={e => setSelectedTeamId(e.target.value)} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white">
              <option value="">Select a team</option>
              {userTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={handleDraft} disabled={drafting || !selectedTeamId} className="w-full bg-[#e94560] text-white rounded-lg py-3 font-semibold hover:bg-[#d63851] transition disabled:opacity-50 text-lg">
            {drafting ? 'Drafting...' : '✍️ Draft Players'}
          </button>
          <div className="bg-[#16213e] rounded-xl p-4">
            <h3 className="font-semibold mb-2">Draft Rules</h3>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Each draft gives you up to 5 new players</li>
              <li>• Max roster size is 15 players</li>
              <li>• Players have potential that can grow over seasons</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
