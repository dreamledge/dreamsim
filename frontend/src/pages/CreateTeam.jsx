import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setDoc, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamDoc, leagueDoc, leagueMemberDoc } from '../lib/firestore';

const COLORS = [
  { primary: '#1a1a2e', secondary: '#e94560', name: 'Classic' },
  { primary: '#16213e', secondary: '#0f3460', name: 'Ocean' },
  { primary: '#2d4059', secondary: '#ea5455', name: 'Sunset' },
  { primary: '#0b192c', secondary: '#c70039', name: 'Inferno' },
  { primary: '#1b1b2f', secondary: '#e43f5a', name: 'Neon' },
  { primary: '#222831', secondary: '#00adb5', name: 'Cyber' },
  { primary: '#112d4e', secondary: '#3f72af', name: 'Royal' },
  { primary: '#2c2c54', secondary: '#ff5252', name: 'Ruby' },
];

const CITY_NAMES = ['Bay City', 'Metro', 'Capital', 'Empire', 'Ocean', 'North', 'South', 'East', 'West', 'Central', 'Coastal', 'Summit'];
const TEAM_NAMES = ['Dragons', 'Phoenix', 'Titans', 'Vipers', 'Knights', 'Falcons', 'Thunder', 'Wolves', 'Sharks', 'Hawks', 'Lions', 'Bears'];

export default function CreateTeam() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('league');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    leagueId: leagueId || '', name: '', abbreviation: '',
    primaryColor: COLORS[0].primary, secondaryColor: COLORS[0].secondary, arenaName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const randomName = () => {
    const city = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
    const team = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
    const name = `${city} ${team}`;
    const abbr = name.split(' ').map(w => w[0]).join('').toUpperCase();
    setForm(f => ({ ...f, name, abbreviation: abbr, arenaName: `${name} Arena` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.leagueId || !form.name) return setError('League and team name required');
    setLoading(true);
    try {
      const leagueSnap = await getDoc(leagueDoc(form.leagueId));
      if (!leagueSnap.exists()) return setError('League not found');

      const existing = await getDocs(query(teamsCol(), where('leagueId', '==', form.leagueId), where('userId', '==', user.id)));
      if (!existing.empty) return setError('You already have a team here');

      const seasonSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', form.leagueId), where('status', '==', 'pregame')));
      const seasonId = seasonSnap.empty ? null : seasonSnap.docs[0].id;

      const teamId = uid();
      const abbr = form.abbreviation || form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);

      await setDoc(teamDoc(teamId), {
        name: form.name, abbreviation: abbr, leagueId: form.leagueId,
        userId: user.id, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor,
        arenaName: form.arenaName || `${form.name} Arena`, seasonId: leagueSnap.data().currentSeason || 1,
        wins: 0, losses: 0, isAi: 0, prestige: 50, createdAt: new Date().toISOString(),
      });

      await setDoc(leagueMemberDoc(form.leagueId, user.id), {
        userId: user.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
      }, { merge: true });
      navigate(`/teams/${teamId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Create Team</h2>
      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 animate-slide-up">
        {error && <p className="text-[var(--accent-red)] text-sm bg-[var(--accent-red)]/10 rounded-lg py-2 px-3">{error}</p>}

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">League ID</label>
          <input type="text" value={form.leagueId} onChange={e => setForm(f => ({ ...f, leagueId: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="Paste league ID" />
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Team Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="e.g. Bay City Dragons" />
          </div>
          <button type="button" onClick={randomName} className="btn-ghost px-3 py-2.5 text-sm">🎲</button>
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Abbreviation</label>
          <input type="text" value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} maxLength={4} className="w-24 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white text-center uppercase focus:outline-none focus:border-[var(--accent-orange)] transition-all" />
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Colors</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c.name} type="button" onClick={() => setForm(f => ({ ...f, primaryColor: c.primary, secondaryColor: c.secondary }))}
                className={`color-swatch ${form.primaryColor === c.primary ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${c.primary} 50%, ${c.secondary} 50%)` }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Arena Name</label>
          <input type="text" value={form.arenaName} onChange={e => setForm(f => ({ ...f, arenaName: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="Dragons Den" />
        </div>

        <button type="submit" disabled={loading} className="btn-glow w-full py-2.5 text-sm tracking-wide">
          {loading ? 'Creating...' : 'Create Team'}
        </button>
      </form>
    </div>
  );
}
