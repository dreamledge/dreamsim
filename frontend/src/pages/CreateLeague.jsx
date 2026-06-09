import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leaguesCol, leagueDoc, leagueMemberDoc } from '../lib/firestore';

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
      await setDoc(leagueMemberDoc(leagueId, user.id), {
        userId: user.id,
        role: 'commissioner',
        joinedAt: new Date().toISOString(),
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
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Create League</h2>
      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 animate-slide-up">
        {error && <p className="text-[var(--accent-red)] text-sm bg-[var(--accent-red)]/10 rounded-lg py-2 px-3">{error}</p>}

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">League Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="e.g. Global Basketball League" />
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)]" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Teams</label>
            <select value={form.teamCount} onChange={e => setForm(f => ({ ...f, teamCount: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all">
              {[4, 6, 8, 10, 12, 16, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Playoff Teams</label>
            <select value={form.playoffTeams} onChange={e => setForm(f => ({ ...f, playoffTeams: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all">
              {[2, 4, 8, 16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-glow w-full py-2.5 text-sm tracking-wide">
          {loading ? 'Creating...' : 'Create League'}
        </button>
      </form>
    </div>
  );
}
