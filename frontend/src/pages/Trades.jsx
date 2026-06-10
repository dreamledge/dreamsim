import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol } from '../lib/firestore';

export default function Trades() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const leagueIds = [...new Set(teamSnap.docs.map(d => d.data().leagueId))];
      const lSnap = await getDocs(collection(db, 'leagues'));
      setLeagues(lSnap.docs.filter(d => leagueIds.includes(d.id)).map(d => ({ id: d.id, ...d.data() })));

      const tSnap = await getDocs(collection(db, 'trades'));
      const teamIds = new Set(teamSnap.docs.map(d => d.id));
      setTrades(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => teamIds.has(t.teamAId) || teamIds.has(t.teamBId)));
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
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">Trades</h2>
        {leagues.length > 0 && (
          <button onClick={() => navigate(`/trades/${leagues[0].id}`)} className="btn-glow px-4 py-2 text-sm">New Trade</button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap animate-fade-up">
        {leagues.map(l => (
          <button key={l.id} onClick={() => navigate(`/trades/${l.id}`)} className="btn-ghost px-3 py-1.5 text-sm">{l.name}</button>
        ))}
      </div>

      <div className="glass-card p-4 animate-fade-up">
        <h3 className="font-display text-lg tracking-wider mb-3">Recent Trades</h3>
        {trades.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No trades yet.</p>
        ) : (
          <div className="space-y-2">
            {trades.map(trade => (
              <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-sm font-medium">{trade.teamAId?.slice(0, 8)}</span>
                <span className={`badge ${
                  trade.status === 'accepted' ? 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20' :
                  trade.status === 'rejected' ? 'bg-red-500/20 text-[var(--accent-red)] border border-red-500/20' :
                  'bg-yellow-500/20 text-[var(--accent-yellow)] border border-yellow-500/20'
                }`}>{trade.status}</span>
                <span className="text-sm font-medium">{trade.teamBId?.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
