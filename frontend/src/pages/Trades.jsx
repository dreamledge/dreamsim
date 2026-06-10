import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, tradesCol, tradeDoc, teamPlayerDoc } from '../lib/firestore';

function statusBadge(status) {
  const map = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    countered: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    commissioner_pending: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    approved: 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',
    declined: 'bg-red-500/20 text-red-400 border-red-500/20',
    vetoed: 'bg-red-500/20 text-red-400 border-red-500/20',
  };
  return `badge ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'}`;
}

export default function Trades() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [trades, setTrades] = useState([]);
  const [commishTrades, setCommishTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrades = async () => {
    const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
    const leagueIds = [...new Set(teamSnap.docs.map(d => d.data().leagueId))];
    const lSnap = await getDocs(collection(db, 'leagues'));
    const myLeagues = lSnap.docs.filter(d => leagueIds.includes(d.id)).map(d => ({ id: d.id, ...d.data() }));
    setLeagues(myLeagues);

    const tSnap = await getDocs(collection(db, 'trades'));
    const teamIds = new Set(teamSnap.docs.map(d => d.id));
    const myTrades = tSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => teamIds.has(t.teamAId) || teamIds.has(t.teamBId));
    setTrades(myTrades);

    const userIds = new Set(teamSnap.docs.map(d => d.data().userId));
    const commishPairs = [];
    for (const l of myLeagues) {
      if (l.commissionerId === user.id) {
        commishPairs.push({ leagueId: l.id, leagueName: l.name });
      }
    }
    const ct = [];
    for (const cp of commishPairs) {
      const leagueTrades = tSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.leagueId === cp.leagueId && t.status === 'commissioner_pending');
      ct.push(...leagueTrades.map(t => ({ ...t, leagueName: cp.leagueName })));
    }
    setCommishTrades(ct);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadTrades();
  }, [user]);

  const executeTrade = async (trade) => {
    try {
      for (const playerId of trade.teamAPlayers) {
        const pDoc = await getDoc(teamPlayerDoc(trade.teamAId, playerId));
        if (pDoc.exists()) {
          const data = pDoc.data();
          await setDoc(teamPlayerDoc(trade.teamBId, playerId), { ...data, teamId: trade.teamBId });
          await deleteDoc(teamPlayerDoc(trade.teamAId, playerId));
        }
      }
      for (const playerId of trade.teamBPlayers) {
        const pDoc = await getDoc(teamPlayerDoc(trade.teamBId, playerId));
        if (pDoc.exists()) {
          const data = pDoc.data();
          await setDoc(teamPlayerDoc(trade.teamAId, playerId), { ...data, teamId: trade.teamAId });
          await deleteDoc(teamPlayerDoc(trade.teamBId, playerId));
        }
      }
      await updateDoc(tradeDoc(trade.id), { status: 'approved', updatedAt: new Date().toISOString() });
      await loadTrades();
    } catch (err) {
      alert('Trade execution failed: ' + err.message);
    }
  };

  const vetoTrade = async (trade) => {
    try {
      await updateDoc(tradeDoc(trade.id), { status: 'vetoed', updatedAt: new Date().toISOString() });
      await loadTrades();
    } catch (err) {
      alert(err.message);
    }
  };

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

      {commishTrades.length > 0 && (
        <div className="glass-card p-4 animate-fade-up border-l-2 border-yellow-500/40">
          <h3 className="font-display text-lg tracking-wider mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
            Commissioner Approval Required
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400">{commishTrades.length}</span>
          </h3>
          <div className="space-y-2">
            {commishTrades.map(trade => {
              const aTeam = trade.teamAName || trade.teamAId.slice(0, 8);
              const bTeam = trade.teamBName || trade.teamBId.slice(0, 8);
              return (
                <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{aTeam}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{trade.leagueName}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    <span className="text-sm font-medium">{bTeam}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] mb-2">
                    {trade.teamAName || aTeam} gives {trade.teamAPlayers.length} players | {trade.teamBName || bTeam} gives {trade.teamBPlayers.length} players
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => executeTrade(trade)} className="flex-1 bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded-lg py-1.5 text-[10px] hover:bg-[var(--accent-teal)]/20 transition-all">Approve</button>
                    <button onClick={() => vetoTrade(trade)} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg py-1.5 text-[10px] hover:bg-red-500/20 transition-all">Veto</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass-card p-4 animate-fade-up">
        <h3 className="font-display text-lg tracking-wider mb-3">Recent Trades</h3>
        {trades.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No trades yet.</p>
        ) : (
          <div className="space-y-2">
            {trades.map(trade => {
              const aTeam = trade.teamAName || trade.teamAId?.slice(0, 8);
              const bTeam = trade.teamBName || trade.teamBId?.slice(0, 8);
              return (
                <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
                  <span className="text-sm font-medium">{aTeam}</span>
                  <span className={statusBadge(trade.status)}>{trade.status}</span>
                  <span className="text-sm font-medium">{bTeam}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
