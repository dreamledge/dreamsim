import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leaguesCol, leagueDoc } from '../lib/firestore';

export default function CreateLeague() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', teamCount: 8, seasonLength: 82, playoffTeams: 8 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return setError('League name required');
    setLoading(true);
    try {
      const leagueId = uid();
      const seasonId = uid();
      await setDoc(leagueDoc(leagueId), {
        name: form.name,
        description: form.description || '',
        commissionerId: user.id,
        teamCount: Number(form.teamCount),
        seasonLength: Number(form.seasonLength),
        playoffTeams: Number(form.playoffTeams),
        currentSeason: 1,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'seasons', seasonId), {
        leagueId,
        seasonNumber: 1,
        status: 'pregame',
        currentWeek: 0,
        totalWeeks: 24,
        createdAt: new Date().toISOString(),
      });
      navigate(`/leagues/${leagueId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New League</h2>
      <form onSubmit={handleSubmit} className="bg-[#16213e] rounded-xl p-5 space-y-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div>
          <label className="text-sm text-gray-400 block mb-1">League Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#e94560]" placeholder="e.g. Global Basketball League" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#e94560]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Teams</label>
            <select value={form.teamCount} onChange={e => setForm(f => ({ ...f, teamCount: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white">
              {[4, 6, 8, 10, 12, 16, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Playoff Teams</label>
            <select value={form.playoffTeams} onChange={e => setForm(f => ({ ...f, playoffTeams: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white">
              {[2, 4, 8, 16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[#e94560] text-white rounded-lg py-2.5 font-semibold hover:bg-[#d63851] transition disabled:opacity-50">
          {loading ? 'Creating...' : 'Create League'}
        </button>
      </form>
    </div>
  );
}
