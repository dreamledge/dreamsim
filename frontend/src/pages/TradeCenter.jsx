import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDocs, query, where, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamPlayersCol, teamPlayerDoc, tradesCol, tradeDoc, leagueDoc } from '../lib/firestore';
import { generateTradeAnalysis } from '../engine/aiEngine';

function PlayerCheckbox({ p, selected, toggle, label }) {
  return (
    <label onClick={toggle} className={`flex items-center gap-2 text-sm py-2 px-3 rounded-xl cursor-pointer transition-all duration-200 group border ${
      selected
        ? 'bg-[var(--accent-orange)]/5 border-[var(--accent-orange)]/20 shadow-[0_0_8px_rgba(255,107,53,0.08)]'
        : 'bg-[var(--bg-secondary)]/40 border-[var(--border-subtle)]/40 hover:bg-[var(--bg-secondary)] hover:border-[var(--border-subtle)]'
    }`}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
        selected ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)] shadow-[0_0_6px_rgba(255,107,53,0.3)]' : 'border-[var(--text-tertiary)] group-hover:border-[var(--text-secondary)]'
      }`}>
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <span className="flex-1 text-center leading-tight truncate min-w-0">{label || `${p.firstName} ${p.lastName}`}</span>
      <span className="text-[var(--text-tertiary)] text-[11px] font-mono w-[52px] text-right shrink-0">{p.position} · {p.overall}</span>
    </label>
  );
}

function DraftPickBadge({ pick, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      R{pick.round} {pick.year}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:text-red-400 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </span>
  );
}

function PlayerAvatars({ players, getPlayer }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.length === 0 ? (
        <span className="text-xs text-[var(--text-tertiary)]">None</span>
      ) : (
        players.map(pid => {
          const p = getPlayer(pid);
          return (
            <span key={pid} className="px-2 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              {p ? `${p.firstName?.slice(0, 1)}. ${p.lastName} (${p.position})` : pid.slice(0, 8)}
              {p && <span className="ml-1 text-[var(--text-tertiary)]">{p.overall}</span>}
            </span>
          );
        })
      )}
    </div>
  );
}

function DraftPicks({ picks }) {
  if (!picks || picks.length === 0) return <span className="text-xs text-[var(--text-tertiary)]">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {picks.map((pk, i) => (
        <DraftPickBadge key={i} pick={pk} />
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="font-display text-lg tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TradeCenter() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [userTeam, setUserTeam] = useState(null);
  const [league, setLeague] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [myPlayers, setMyPlayers] = useState([]);
  const [targetPlayers, setTargetPlayers] = useState([]);
  const [selectedMy, setSelectedMy] = useState([]);
  const [selectedTargetPlayers, setSelectedTargetPlayers] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  const [incomingTrades, setIncomingTrades] = useState([]);
  const [outgoingTrades, setOutgoingTrades] = useState([]);
  const [commishTrades, setCommishTrades] = useState([]);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [counterTrade, setCounterTrade] = useState(null);
  const [counterMyPlayers, setCounterMyPlayers] = useState([]);
  const [counterTheirPlayers, setCounterTheirPlayers] = useState([]);
  const [counterMyPicks, setCounterMyPicks] = useState([]);
  const [counterTheirPicks, setCounterTheirPicks] = useState([]);
  const [allPlayersCache, setAllPlayersCache] = useState({});
  const [counterMyTeamPlayers, setCounterMyTeamPlayers] = useState([]);
  const [counterTheirTeamPlayers, setCounterTheirTeamPlayers] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  const loadTrades = async (teamId, isCommish) => {
    const tSnap = await getDocs(query(tradesCol(), where('leagueId', '==', leagueId)));
    const allTrades = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setIncomingTrades(allTrades.filter(t => t.teamBId === teamId && t.status === 'pending'));
    setOutgoingTrades(allTrades.filter(t => t.teamAId === teamId && t.status !== 'approved' && t.status !== 'declined' && t.status !== 'vetoed'));
    if (isCommish) {
      setCommishTrades(allTrades.filter(t => t.status === 'commissioner_pending'));
    }
    return allTrades;
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const lSnap = await getDoc(leagueDoc(leagueId));
        const lData = lSnap.exists() ? { id: lSnap.id, ...lSnap.data() } : null;
        setLeague(lData);
        const isCommish = lData?.commissionerId === user.id;

        const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', leagueId)));
        const allTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTeams(allTeams);

        const my = allTeams.find(t => t.userId === user.id);
        if (my) {
          const pSnap = await getDocs(teamPlayersCol(my.id));
          const players = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setMyPlayers(players);
          const cache = {};
          players.forEach(p => cache[p.id] = p);
          setAllPlayersCache(cache);
          await loadTrades(my.id, isCommish);
        }
        setUserTeam(my || null);
      } catch (err) {
        console.error('TradeCenter load error:', err);
        alert('Error loading Trade Center: ' + err.message);
      }
    };
    load();
  }, [leagueId, user]);

  const selectTarget = async (teamId) => {
    setSelectedTarget(teamId);
    setSelectedTargetPlayers([]);
    const pSnap = await getDocs(teamPlayersCol(teamId));
    const players = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setTargetPlayers(players);
    setAllPlayersCache(prev => {
      const next = { ...prev };
      players.forEach(p => next[p.id] = p);
      return next;
    });
  };

  const toggleMy = (pid) => setSelectedMy(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  const toggleTarget = (pid) => setSelectedTargetPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);

  const analyze = () => {
    if (!userTeam || !selectedTarget) return;
    const aPlayers = myPlayers.filter(p => selectedMy.includes(p.id));
    const bPlayers = targetPlayers.filter(p => selectedTargetPlayers.includes(p.id));
    const tA = teams.find(t => t.id === userTeam.id);
    const tB = teams.find(t => t.id === selectedTarget);
    setAnalysis(generateTradeAnalysis(tA || { name: 'You' }, tB || { name: 'Them' }, aPlayers, bPlayers));
  };

  const submitTrade = async () => {
    if (!leagueId || !userTeam || !selectedTarget) return;
    try {
      const targetTeam = teams.find(t => t.id === selectedTarget);
      await setDoc(tradeDoc(uid()), {
        leagueId, teamAId: userTeam.id, teamBId: selectedTarget,
        teamAPlayers: selectedMy, teamBPlayers: selectedTargetPlayers,
        teamADraftPicks: [], teamBDraftPicks: [],
        teamAName: userTeam.name, teamBName: targetTeam?.name || '',
        status: 'pending', proposedBy: user.id,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        parentTradeId: null,
      });
      setSelectedTarget(null);
      setSelectedMy([]);
      setSelectedTargetPlayers([]);
      setTargetPlayers([]);
      setAnalysis(null);
      setSuccessMsg('Trade proposed successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert(err.message);
    }
  };

  const getTeamName = (teamId) => {
    const t = teams.find(t => t.id === teamId);
    return t?.name || teamId.slice(0, 8);
  };

  const getPlayer = (pid) => allPlayersCache[pid] || null;

  const viewTrade = (trade) => {
    setViewingTrade(trade);
  };

  const acceptTrade = async (trade) => {
    try {
      await updateDoc(tradeDoc(trade.id), { status: 'commissioner_pending', updatedAt: new Date().toISOString() });
      setViewingTrade(null);
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert(err.message);
    }
  };

  const declineTrade = async (trade) => {
    try {
      await updateDoc(tradeDoc(trade.id), { status: 'declined', updatedAt: new Date().toISOString() });
      setViewingTrade(null);
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (!counterTrade) return;
    const load = async () => {
      const mySnap = await getDocs(teamPlayersCol(counterTrade.teamBId));
      const myPs = mySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCounterMyTeamPlayers(myPs);
      setAllPlayersCache(prev => {
        const next = { ...prev };
        myPs.forEach(p => next[p.id] = p);
        return next;
      });
      const theirSnap = await getDocs(teamPlayersCol(counterTrade.teamAId));
      const theirPs = theirSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCounterTheirTeamPlayers(theirPs);
      setAllPlayersCache(prev => {
        const next = { ...prev };
        theirPs.forEach(p => next[p.id] = p);
        return next;
      });
    };
    load();
  }, [counterTrade]);

  const openCounter = (trade) => {
    setCounterTrade(trade);
    setCounterMyPlayers([...trade.teamBPlayers]);
    setCounterTheirPlayers([...trade.teamAPlayers]);
    setCounterMyPicks(trade.teamBDraftPicks || []);
    setCounterTheirPicks(trade.teamADraftPicks || []);
    setViewingTrade(null);
  };

  const toggleCounterMy = (pid) => {
    setCounterMyPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const toggleCounterTheir = (pid) => {
    setCounterTheirPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const addPick = (side) => {
    const picks = side === 'my' ? counterMyPicks : counterTheirPicks;
    const year = new Date().getFullYear() + Math.floor(picks.length / 2);
    const round = (picks.length % 2) + 1;
    const setter = side === 'my' ? setCounterMyPicks : setCounterTheirPicks;
    setter(prev => [...prev, { round, year }]);
  };

  const removePick = (side, idx) => {
    const setter = side === 'my' ? setCounterMyPicks : setCounterTheirPicks;
    setter(prev => prev.filter((_, i) => i !== idx));
  };

  const submitCounter = async () => {
    if (!counterTrade) return;
    try {
      await updateDoc(tradeDoc(counterTrade.id), { status: 'countered', updatedAt: new Date().toISOString() });
      const newTradeData = {
        leagueId: counterTrade.leagueId,
        teamAId: counterTrade.teamBId,
        teamBId: counterTrade.teamAId,
        teamAPlayers: counterMyPlayers,
        teamBPlayers: counterTheirPlayers,
        teamADraftPicks: counterMyPicks,
        teamBDraftPicks: counterTheirPicks,
        status: 'pending',
        proposedBy: user.id,
        teamAName: getTeamName(counterTrade.teamBId),
        teamBName: getTeamName(counterTrade.teamAId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parentTradeId: counterTrade.id,
      };
      await setDoc(tradeDoc(uid()), newTradeData);
      setCounterTrade(null);
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert(err.message);
    }
  };

  const executeTrade = async (trade) => {
    setViewingTrade(null);
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
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert('Trade execution failed: ' + err.message);
    }
  };

  const approveTrade = async (trade) => {
    await executeTrade(trade);
  };

  const vetoTrade = async (trade) => {
    try {
      await updateDoc(tradeDoc(trade.id), { status: 'vetoed', updatedAt: new Date().toISOString() });
      const isCommish = league?.commissionerId === user.id;
      if (userTeam) await loadTrades(userTeam.id, isCommish);
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
      countered: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
      commissioner_pending: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
      approved: 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',
      declined: 'bg-red-500/20 text-red-400 border-red-500/20',
      vetoed: 'bg-red-500/20 text-red-400 border-red-500/20',
    };
    return `badge ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'}`;
  };

  const isCurrentUserInvolved = (trade) => {
    return trade.teamAId === userTeam?.id || trade.teamBId === userTeam?.id;
  };

  const isCommish = league?.commissionerId === user.id;

  if (!userTeam) return <div className="glass-card p-6 text-center"><p className="text-[var(--text-secondary)]">You need a team in this league first.</p></div>;

  return (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-2 -mt-1"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        Trade Center
      </h2>

      {/* ── Propose Trade ── */}
      <div className="glass-card p-4 animate-fade-up">
        <h3 className="font-display text-lg tracking-wider mb-3 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent-orange)]/20 to-[var(--accent-red)]/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </span>
          Propose Trade
        </h3>

        {successMsg && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/20 text-[var(--accent-teal)] text-xs text-center font-medium animate-fade-up">
            {successMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-xs text-[var(--text-tertiary)] mb-2.5 font-medium tracking-wide uppercase text-center">{userTeam.name}</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {myPlayers.map(p => (
                <PlayerCheckbox key={p.id} p={p} selected={selectedMy.includes(p.id)} toggle={() => toggleMy(p.id)} />
              ))}
            </div>
          </div>

          {selectedTarget && targetPlayers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 justify-center">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
                <p className="text-xs text-[var(--text-tertiary)] font-medium tracking-wide uppercase">{getTeamName(selectedTarget)}</p>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {targetPlayers.map(p => (
                  <PlayerCheckbox key={p.id} p={p} selected={selectedTargetPlayers.includes(p.id)} toggle={() => toggleTarget(p.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <p className="text-xs text-[var(--text-tertiary)] mb-2 font-medium tracking-wide uppercase">Target Team</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {teams.filter(t => t.id !== userTeam.id).map(t => (
              <button key={t.id} onClick={() => selectTarget(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTarget === t.id
                  ? 'bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-white shadow-md scale-105'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-white'
              }`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {(selectedMy.length > 0 || selectedTargetPlayers.length > 0) && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <button onClick={analyze} className="flex-1 btn-ghost py-2.5 text-xs flex items-center justify-center gap-1.5 rounded-xl">
              <span className="badge badge-ai">AI</span> Analyze
            </button>
            <button onClick={submitTrade} className="flex-1 btn-glow py-2.5 text-xs rounded-xl">Propose Trade</button>
          </div>
        )}
      </div>

      {analysis && (
        <div className="glass-card p-4 animate-scale-in" style={{borderLeft: `3px solid ${analysis.score > 50 ? 'var(--accent-teal)' : 'var(--accent-red)'}`}}>
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-ai">AI</span>
            <h3 className="font-display text-lg tracking-wider">Trade Analysis</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-display text-2xl ${analysis.score > 50 ? 'text-[var(--accent-teal)]' : 'text-[var(--accent-red)]'}`}>{analysis.verdict}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-24 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className={`h-full rounded-full transition-all ${analysis.score > 50 ? 'bg-[var(--accent-teal)]' : 'bg-[var(--accent-red)]'}`} style={{width: `${Math.abs(analysis.score)}%`}} />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">{analysis.score}/100</span>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-2">{analysis.explanation}</p>
        </div>
      )}

      {/* ── Incoming Proposals ── */}
      {incomingTrades.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <h3 className="font-display text-lg tracking-wider mb-3">
            Incoming Proposals
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]">{incomingTrades.length}</span>
          </h3>
          <div className="space-y-2">
            {incomingTrades.map(trade => (
              <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{getTeamName(trade.teamAId)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  <span className="text-sm font-medium">{getTeamName(trade.teamBId)}</span>
                </div>
                <div className="flex gap-2 text-xs mb-2">
                  <div className="flex-1">
                    <span className="text-[var(--text-tertiary)]">They give: </span>
                    <span className="font-medium">{trade.teamAPlayers.length} players</span>
                    {trade.teamADraftPicks?.length > 0 && <span className="text-[var(--text-tertiary)]"> + {trade.teamADraftPicks.length} picks</span>}
                  </div>
                  <div className="flex-1 text-right">
                    <span className="text-[var(--text-tertiary)]">You give: </span>
                    <span className="font-medium">{trade.teamBPlayers.length} players</span>
                    {trade.teamBDraftPicks?.length > 0 && <span className="text-[var(--text-tertiary)]"> + {trade.teamBDraftPicks.length} picks</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => viewTrade(trade)} className="flex-1 btn-ghost py-1.5 text-[10px]">View</button>
                  <button onClick={() => acceptTrade(trade)} className="flex-1 bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded-lg py-1.5 text-[10px] hover:bg-[var(--accent-teal)]/20 transition-all">Accept</button>
                  <button onClick={() => openCounter(trade)} className="flex-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg py-1.5 text-[10px] hover:bg-purple-500/20 transition-all">Counter</button>
                  <button onClick={() => declineTrade(trade)} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg py-1.5 text-[10px] hover:bg-red-500/20 transition-all">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Outgoing Proposals ── */}
      {outgoingTrades.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <h3 className="font-display text-lg tracking-wider mb-3">
            Your Proposals
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400">{outgoingTrades.length}</span>
          </h3>
          <div className="space-y-2">
            {outgoingTrades.map(trade => (
              <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{getTeamName(trade.teamBId)}</span>
                    <span className={statusBadge(trade.status)}>{trade.status}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    You give: {trade.teamAPlayers.length} players
                    {trade.teamADraftPicks?.length > 0 && ` + ${trade.teamADraftPicks.length} picks`}
                    &nbsp;|&nbsp; You get: {trade.teamBPlayers.length} players
                    {trade.teamBDraftPicks?.length > 0 && ` + ${trade.teamBDraftPicks.length} picks`}
                  </p>
                  {trade.parentTradeId && <p className="text-[9px] text-purple-400/60 mt-0.5">Counter-offer</p>}
                </div>
                <button onClick={() => viewTrade(trade)} className="btn-ghost px-2.5 py-1.5 text-[10px] shrink-0 ml-2">View</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Commissioner Approval ── */}
      {isCommish && commishTrades.length > 0 && (
        <div className="glass-card p-4 animate-slide-up border-l-2 border-yellow-500/40">
          <h3 className="font-display text-lg tracking-wider mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
            Commissioner Approval Required
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400">{commishTrades.length}</span>
          </h3>
          <div className="space-y-2">
            {commishTrades.map(trade => (
              <div key={trade.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{getTeamName(trade.teamAId)}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  <span className="text-sm font-medium">{getTeamName(trade.teamBId)}</span>
                </div>
                <div className="flex gap-2 text-xs mb-2">
                  <div className="flex-1">
                    <span className="text-[var(--text-tertiary)]">{getTeamName(trade.teamAId)} gives: </span>
                    <span className="font-medium">{trade.teamAPlayers.length} players</span>
                    {trade.teamADraftPicks?.length > 0 && <span className="text-[var(--text-tertiary)]"> + {trade.teamADraftPicks.length} picks</span>}
                  </div>
                  <div className="flex-1 text-right">
                    <span className="text-[var(--text-tertiary)]">{getTeamName(trade.teamBId)} gives: </span>
                    <span className="font-medium">{trade.teamBPlayers.length} players</span>
                    {trade.teamBDraftPicks?.length > 0 && <span className="text-[var(--text-tertiary)]"> + {trade.teamBDraftPicks.length} picks</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => viewTrade(trade)} className="flex-1 btn-ghost py-1.5 text-[10px]">Review</button>
                  <button onClick={() => approveTrade(trade)} className="flex-1 bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded-lg py-1.5 text-[10px] hover:bg-[var(--accent-teal)]/20 transition-all">Approve</button>
                  <button onClick={() => vetoTrade(trade)} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg py-1.5 text-[10px] hover:bg-red-500/20 transition-all">Veto</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Trade Detail Modal ── */}
      <Modal open={!!viewingTrade} onClose={() => setViewingTrade(null)} title="Trade Details">
        {viewingTrade && (() => {
          const t = viewingTrade;
          const isIncoming = t.teamBId === userTeam?.id;
          const isPending = t.status === 'pending' || t.status === 'countered';
          const isCommishPending = t.status === 'commissioner_pending';
          const canAccept = isIncoming && isPending;
          const canCounter = isIncoming && isPending;
          const canDecline = isIncoming && isPending;
          const canCommishAction = isCommish && isCommishPending;

          return (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-display">{getTeamName(t.teamAId)}</span>
                <span className={statusBadge(t.status)} style={{ fontSize: '10px' }}>{t.status}</span>
                <span className="text-sm font-display">{getTeamName(t.teamBId)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg-secondary)] rounded-xl p-3">
                  <p className="text-xs font-medium mb-2">{getTeamName(t.teamAId)} sends</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">Players</p>
                  <PlayerAvatars players={t.teamAPlayers} getPlayer={getPlayer} />
                  {t.teamADraftPicks?.length > 0 && (
                    <>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-2 mb-1">Draft Picks</p>
                      <DraftPicks picks={t.teamADraftPicks} />
                    </>
                  )}
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-3">
                  <p className="text-xs font-medium mb-2">{getTeamName(t.teamBId)} sends</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">Players</p>
                  <PlayerAvatars players={t.teamBPlayers} getPlayer={getPlayer} />
                  {t.teamBDraftPicks?.length > 0 && (
                    <>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-2 mb-1">Draft Picks</p>
                      <DraftPicks picks={t.teamBDraftPicks} />
                    </>
                  )}
                </div>
              </div>

              {t.parentTradeId && (
                <p className="text-[10px] text-purple-400/60 text-center">Counter-offer (original: {t.parentTradeId.slice(0, 8)}...)</p>
              )}

              <div className="flex gap-2 pt-2">
                {canAccept && <button onClick={() => acceptTrade(t)} className="flex-1 bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded-lg py-2 text-xs hover:bg-[var(--accent-teal)]/20 transition-all">Accept</button>}
                {canCounter && <button onClick={() => openCounter(t)} className="flex-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg py-2 text-xs hover:bg-purple-500/20 transition-all">Counter</button>}
                {canDecline && <button onClick={() => declineTrade(t)} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg py-2 text-xs hover:bg-red-500/20 transition-all">Decline</button>}
                {canCommishAction && (
                  <>
                    <button onClick={() => approveTrade(t)} className="flex-1 bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded-lg py-2 text-xs hover:bg-[var(--accent-teal)]/20 transition-all">Approve</button>
                    <button onClick={() => vetoTrade(t)} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg py-2 text-xs hover:bg-red-500/20 transition-all">Veto</button>
                  </>
                )}
                {!canAccept && !canCounter && !canDecline && !canCommishAction && (
                  <p className="text-xs text-[var(--text-tertiary)] text-center w-full">This trade has been {t.status}.</p>
                )}
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── Counter Modal ── */}
      <Modal open={!!counterTrade} onClose={() => setCounterTrade(null)} title="Counter-Offer">
        {counterTrade && (() => {
          const t = counterTrade;
          const myTeam = teams.find(tm => tm.id === t.teamBId);
          const theirTeam = teams.find(tm => tm.id === t.teamAId);

          return (
            <>
              <p className="text-xs text-[var(--text-tertiary)] mb-2">
                Modify the trade and re-send to {theirTeam?.name || 'the other team'}
              </p>

              <div>
                <p className="text-xs font-medium mb-1">Players You Send ({myTeam?.name})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {counterMyTeamPlayers.map(p => (
                    <PlayerCheckbox key={p.id} p={p} selected={counterMyPlayers.includes(p.id)} toggle={() => toggleCounterMy(p.id)} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">Draft picks:</span>
                  <div className="flex flex-wrap gap-1">
                    {counterMyPicks.map((pk, i) => (
                      <DraftPickBadge key={i} pick={pk} onRemove={() => removePick('my', i)} />
                    ))}
                  </div>
                  <button onClick={() => addPick('my')} className="text-[10px] text-[var(--accent-orange)] hover:text-white transition-colors">+ Add Pick</button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1">Players You Want ({theirTeam?.name})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {counterTheirTeamPlayers.map(p => (
                    <PlayerCheckbox key={p.id} p={p} selected={counterTheirPlayers.includes(p.id)} toggle={() => toggleCounterTheir(p.id)} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">Draft picks:</span>
                  <div className="flex flex-wrap gap-1">
                    {counterTheirPicks.map((pk, i) => (
                      <DraftPickBadge key={i} pick={pk} onRemove={() => removePick('their', i)} />
                    ))}
                  </div>
                  <button onClick={() => addPick('their')} className="text-[10px] text-[var(--accent-orange)] hover:text-white transition-colors">+ Add Pick</button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setCounterTrade(null)} className="flex-1 btn-ghost py-2 text-xs">Cancel</button>
                <button onClick={submitCounter} className="flex-1 btn-glow py-2 text-xs">Send Counter-Offer</button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
