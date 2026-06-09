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
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Player Draft</h2>
      <p className="text-[var(--text-secondary)] text-sm animate-fade-up">Draft new players to fill out your roster</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="relative loader-2k" />
        </div>
      ) : userTeams.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)] mb-3">Create a team first</p>
          <Link to="/teams/create" className="text-[var(--accent-orange)] font-medium text-sm hover:text-white transition-colors">Create Team →</Link>
        </div>
      ) : (
        <>
          <div className="glass-card p-4 animate-fade-up">
            <select value={selectedTeamId || ''} onChange={e => setSelectedTeamId(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all">
              <option value="">Select a team</option>
              {userTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <button onClick={handleDraft} disabled={drafting || !selectedTeamId} className="btn-glow w-full py-3 text-sm tracking-wide disabled:opacity-50">
            {drafting ? '✍️ Drafting...' : '✍️ Draft Players'}
          </button>

          <div className="glass-card p-4 animate-slide-up">
            <h3 className="font-display text-lg tracking-wider mb-2">Draft Rules</h3>
            <ul className="text-sm text-[var(--text-tertiary)] space-y-1.5">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-orange)] flex-shrink-0" />Each draft gives you up to 5 new players</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-orange)] flex-shrink-0" />Max roster size is 15 players</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-orange)] flex-shrink-0" />Players have potential that can grow over seasons</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
