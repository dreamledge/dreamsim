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

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-2 -mt-1"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
        Stats
      </h2>

      {leaders.length > 0 ? (
        <>
          <div className="glass-card p-4 animate-fade-up">
            <h3 className="font-display text-lg tracking-wider mb-3">Scoring Leaders</h3>
            <div className="overflow-x-auto">
              <div className="min-w-[400px] space-y-1">
                <div className="grid grid-cols-4 text-xs text-[var(--text-tertiary)] px-2 pb-2 border-b border-[var(--border-subtle)] uppercase tracking-wider font-semibold">
                  <span className="col-span-2">Player</span><span className="text-right">PPG</span><span className="text-right">Team</span>
                </div>
                {leaders.slice(0, 15).map((p, i) => (
                  <div key={p.id} className="grid grid-cols-4 items-center px-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                    <span className="col-span-2 flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < 3 ? 'bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] text-white' : 'text-[var(--text-tertiary)]'
                      }`}>{i + 1}</span>
                      <span className="font-medium">{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{p.position}</span>
                    </span>
                    <span className="text-right font-display text-lg tracking-wide">{(p.statsPpg || 0).toFixed(1)}</span>
                    <span className="text-right text-xs text-[var(--text-tertiary)]">{p.teamName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-up">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-teal)]/20 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <h4 className="font-display text-base tracking-wider">Rebounds</h4>
              </div>
              <div className="space-y-1.5 text-sm">
                {[...leaders].sort((a, b) => (b.statsRpg || 0) - (a.statsRpg || 0)).slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span className="text-[var(--text-secondary)] truncate mr-2">{p.firstName} {p.lastName}</span>
                    <span className="font-display text-lg text-[var(--accent-teal)]">{(p.statsRpg || 0).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h4 className="font-display text-base tracking-wider">Assists</h4>
              </div>
              <div className="space-y-1.5 text-sm">
                {[...leaders].sort((a, b) => (b.statsApg || 0) - (a.statsApg || 0)).slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span className="text-[var(--text-secondary)] truncate mr-2">{p.firstName} {p.lastName}</span>
                    <span className="font-display text-lg text-[var(--accent-blue)]">{(p.statsApg || 0).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No stats available yet. Start simulating games!</p>
        </div>
      )}
    </div>
  );
}
