import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocs, collection, query, where, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamDoc, teamPlayersCol, tradesCol, tradeDoc } from '../lib/firestore';
import { generateTradeAnalysis } from '../engine/aiEngine';

export default function TradeCenter() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [userTeam, setUserTeam] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [myPlayers, setMyPlayers] = useState([]);
  const [targetPlayers, setTargetPlayers] = useState([]);
  const [selectedMy, setSelectedMy] = useState([]);
  const [selectedTargetPlayers, setSelectedTargetPlayers] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', leagueId)));
      const allTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(allTeams);
      const my = allTeams.find(t => t.userId === user.id);
      setUserTeam(my || null);
      if (my) {
        const pSnap = await getDocs(teamPlayersCol(my.id));
        setMyPlayers(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    };
    load();
  }, [leagueId, user]);

  const selectTarget = async (teamId) => {
    setSelectedTarget(teamId);
    setSelectedTargetPlayers([]);
    const pSnap = await getDocs(teamPlayersCol(teamId));
    setTargetPlayers(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      await setDoc(tradeDoc(uid()), {
        leagueId, teamAId: userTeam.id, teamBId: selectedTarget,
        teamAPlayers: selectedMy, teamBPlayers: selectedTargetPlayers,
        status: 'pending', createdAt: new Date().toISOString(),
      });
      alert('Trade proposed!');
      setSelectedMy([]);
      setSelectedTargetPlayers([]);
      setAnalysis(null);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!userTeam) return <div className="glass-card p-6 text-center"><p className="text-[var(--text-secondary)]">You need a team in this league first.</p></div>;

  return (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-2 -mt-1"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        Trade Center
      </h2>

      <div className="glass-card p-4 animate-fade-up">
        <h3 className="font-display text-lg tracking-wider mb-2">Your Team: {userTeam.name}</h3>
        <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
          {myPlayers.map(p => (
            <label key={p.id} className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedMy.includes(p.id) ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]' : 'border-[var(--text-tertiary)]'}`}>
                {selectedMy.includes(p.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span>{p.firstName} {p.lastName} ({p.position})</span>
              <span className="text-[var(--text-tertiary)] ml-auto text-xs">OVR {p.overall}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 animate-fade-up">
        <h3 className="font-display text-lg tracking-wider mb-2">Target Team</h3>
        <div className="space-y-1">
          {teams.filter(t => t.id !== userTeam.id).map(t => (
            <button key={t.id} onClick={() => selectTarget(t.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
              selectedTarget === t.id ? 'bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-white shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}>
              <span className="font-medium">{t.name}</span>
              <span className="text-xs ml-2 opacity-70">({t.wins || 0}W - {t.losses || 0}L)</span>
            </button>
          ))}
        </div>
      </div>

      {selectedTarget && targetPlayers.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <h3 className="font-display text-lg tracking-wider mb-2">Target Players</h3>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {targetPlayers.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedTargetPlayers.includes(p.id) ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]' : 'border-[var(--text-tertiary)]'}`}>
                  {selectedTargetPlayers.includes(p.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span>{p.firstName} {p.lastName} ({p.position})</span>
                <span className="text-[var(--text-tertiary)] ml-auto text-xs">OVR {p.overall}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {(selectedMy.length > 0 || selectedTargetPlayers.length > 0) && (
        <div className="flex gap-2 animate-fade-up">
          <button onClick={analyze} className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-2">
            <span className="badge badge-ai">AI</span> Analyze
          </button>
          <button onClick={submitTrade} className="flex-1 btn-glow py-2.5 text-sm">Propose Trade</button>
        </div>
      )}

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
    </div>
  );
}
