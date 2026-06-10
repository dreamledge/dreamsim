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

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Standings</h2>
      <div className="glass-card overflow-hidden animate-fade-up">
        <div className="grid grid-cols-5 text-xs text-[var(--text-tertiary)] px-4 py-3 border-b border-[var(--border-subtle)] uppercase tracking-wider font-semibold">
          <span className="col-span-2">Team</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-right">PCT</span>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {teams.map((team, i) => {
            const pct = ((team.wins || 0) + (team.losses || 0)) > 0 ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(1) : '-';
            return (
              <Link key={team.id} to={`/teams/${team.id}`} className="grid grid-cols-5 items-center px-4 py-3 text-sm hover:bg-[var(--bg-secondary)] transition-colors group">
                <div className="col-span-2 flex items-center gap-2.5">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < 3 ? 'bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] text-white shadow-sm' : 'text-[var(--text-tertiary)]'
                  }`}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-display text-white shadow-sm" style={{ backgroundColor: team.primaryColor || '#ff7b35' }}>
                    {team.abbreviation || team.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{team.name}</span>
                </div>
                <span className="text-center font-display text-lg tracking-wide">{team.wins || 0}</span>
                <span className="text-center text-[var(--text-secondary)]">{team.losses || 0}</span>
                <span className="text-right text-[var(--text-secondary)] font-medium">{pct}{pct !== '-' ? '%' : ''}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
