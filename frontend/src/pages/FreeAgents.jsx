import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { leagueDoc, teamsCol, teamPlayersCol } from '../lib/firestore';
import NBA_PLAYER_POOL from '../engine/nbaPlayerPool.json';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];

export default function FreeAgents() {
  const { id } = useParams();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [userTeam, setUserTeam] = useState(null);
  const [signingStatus, setSigningStatus] = useState({ enabled: false, message: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const lSnap = await getDoc(leagueDoc(id));
        if (!lSnap.exists()) { setLoading(false); return; }
        const lData = { id: lSnap.id, ...lSnap.data() };
        setLeague(lData);

        const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
        const teams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUserTeam(teams.find(t => t.userId === user?.id) || null);

        const takenIds = new Set();
        const playerSnapshots = await Promise.all(
          teams.map(team => getDocs(teamPlayersCol(team.id)).catch(() => ({ docs: [] })))
        );
        for (const pSnap of playerSnapshots) {
          pSnap.docs.forEach(d => {
            if (d.data().playerId) takenIds.add(d.data().playerId);
          });
        }

        const pool = NBA_PLAYER_POOL.players || [];
        setAvailable(pool.filter(p => !takenIds.has(p.playerId)));

        try {
          const sSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', id)));
          const seasonsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
          if (seasonsList.length > 0) {
            const season = seasonsList[0];
            const dSnap = await getDocs(query(collection(db, 'leagues', id, 'drafts'), where('status', '==', 'completed')));
            const hasCompletedDraft = !dSnap.empty;

            if (!hasCompletedDraft) {
              setSigningStatus({ enabled: false, message: 'Free agency opens after the first draft.' });
            } else if (lData.offseason === true) {
              setSigningStatus({ enabled: true, message: 'Offseason — free agency is open.' });
            } else if (season.status === 'regular' && season.currentWeek <= season.totalWeeks / 2) {
              setSigningStatus({ enabled: true, message: 'First half of season — free agency is open.' });
            } else if (season.status === 'regular') {
              setSigningStatus({ enabled: false, message: 'Free agency closes during the second half of the season.' });
            } else if (season.status === 'pregame') {
              setSigningStatus({ enabled: false, message: 'Free agency opens after the first draft.' });
            } else {
              setSigningStatus({ enabled: false, message: 'Free agency is currently closed.' });
            }
          } else {
            setSigningStatus({ enabled: false, message: 'No season found — free agency opens after the first draft.' });
          }
        } catch (e) {}
      } catch (e) {
        console.error('FreeAgents load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  const filtered = available.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchName = !search || fullName.includes(search.toLowerCase());
    const matchPos = positionFilter === 'All' || p.primaryPosition === positionFilter;
    return matchName && matchPos;
  });

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display text-3xl tracking-wider">Free Agents</h2>
          <p className="text-sm text-[var(--text-secondary)]">{available.length} players available</p>
        </div>
        {userTeam && (
          <Link to={`/teams/${userTeam.id}`} className="btn-ghost px-3 py-1.5 text-xs">My Team</Link>
        )}
      </div>

      <div className={`rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-up ${
        signingStatus.enabled
          ? 'bg-green-500/10 border border-green-500/20 text-green-400'
          : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]'
      }`}>
        {signingStatus.enabled ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        )}
        <span>{signingStatus.message}</span>
      </div>

      <div className="glass-card p-4 space-y-3 animate-fade-up">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by player name..."
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all placeholder:text-[var(--text-tertiary)]"
        />
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setPositionFilter(pos)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all duration-200 ${
                positionFilter === pos
                  ? 'bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-white shadow-md'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 animate-slide-up">
        <p className="text-xs text-[var(--text-tertiary)] font-medium mb-2">{filtered.length} players match filters</p>
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {[...filtered].sort((a, b) => (b.overall || 0) - (a.overall || 0)).map((p, i) => (
            <div key={p.playerId} className="glass-card p-3 flex items-center gap-3 transition-all duration-200 hover:bg-[var(--bg-tertiary)]" style={{animationDelay: `${i * 0.02}s`}}>
              <div className="rating-circle rating-circle-sm shrink-0" style={{'--pct': `${p.overall || 50}%`}}>
                <span className="text-white text-xs">{p.overall || '-'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--text-tertiary)]">
                  <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.primaryPosition || p.position}</span>
                  <span>{p.age} yrs</span>
                  <span>{p.height}"</span>
                </div>
                <div className="flex gap-2 mt-1 text-[10px] text-[var(--text-secondary)]">
                  <span>OFF {p.offense || '-'}</span>
                  <span>DEF {p.defense || '-'}</span>
                  <span>SHO {p.shooting || '-'}</span>
                  <span>PLAY {p.playmaking || '-'}</span>
                  <span>REB {p.rebounding || '-'}</span>
                  <span>ATH {p.athleticism || '-'}</span>
                </div>
              </div>
              <div className="text-right text-xs text-[var(--text-tertiary)] shrink-0">
                <p className="font-medium text-[var(--text-secondary)]">{p.statsPpg != null ? Number(p.statsPpg).toFixed(1) : p.ppg != null ? Number(p.ppg).toFixed(1) : '-'} PPG</p>
                <p>{p.statsRpg != null ? Number(p.statsRpg).toFixed(1) : p.rpg != null ? Number(p.rpg).toFixed(1) : '-'} RPG</p>
                <p>{p.statsApg != null ? Number(p.statsApg).toFixed(1) : p.apg != null ? Number(p.apg).toFixed(1) : '-'} APG</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No players match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
