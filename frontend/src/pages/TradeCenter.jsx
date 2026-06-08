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
  const [selectedTargetPlayers, setSelectedTargetPlayerslayers] = useState([]);
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

  if (!userTeam) return <div className="bg-[#16213e] rounded-xl p-6 text-center"><p className="text-gray-500">You need a team in this league first.</p></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">🤝 Trade Center</h2>

      <div className="bg-[#16213e] rounded-xl p-4">
        <h3 className="font-semibold mb-2">Your Team: {userTeam.name}</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {myPlayers.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input type="checkbox" checked={selectedMy.includes(p.id)} onChange={() => toggleMy(p.id)} className="accent-[#e94560]" />
              <span>{p.firstName} {p.lastName} ({p.position})</span>
              <span className="text-gray-500 ml-auto">OVR {p.overall}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-[#16213e] rounded-xl p-4">
        <h3 className="font-semibold mb-2">Target Team</h3>
        <div className="space-y-1">
          {teams.filter(t => t.id !== userTeam.id).map(t => (
            <button key={t.id} onClick={() => selectTarget(t.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedTarget === t.id ? 'bg-[#e94560] text-white' : 'bg-[#1a1a2e] text-gray-300 hover:bg-gray-700'}`}>
              {t.name} ({t.wins || 0}W - {t.losses || 0}L)
            </button>
          ))}
        </div>
      </div>

      {selectedTarget && targetPlayers.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-2">Target Players</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {targetPlayers.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" checked={selectedTargetPlayers.includes(p.id)} onChange={() => toggleTarget(p.id)} className="accent-[#e94560]" />
                <span>{p.firstName} {p.lastName} ({p.position})</span>
                <span className="text-gray-500 ml-auto">OVR {p.overall}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {(selectedMy.length > 0 || selectedTargetPlayers.length > 0) && (
        <div className="flex gap-2">
          <button onClick={analyze} className="flex-1 bg-gray-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-600 transition">🤖 AI Analyze</button>
          <button onClick={submitTrade} className="flex-1 bg-[#e94560] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#d63851] transition">Propose Trade</button>
        </div>
      )}

      {analysis && (
        <div className="bg-[#16213e] rounded-xl p-4 border-l-4" style={{ borderColor: analysis.score > 50 ? '#4ade80' : '#e94560' }}>
          <h3 className="font-semibold mb-2">📊 Trade Analysis</h3>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${analysis.score > 50 ? 'text-green-400' : 'text-red-400'}`}>{analysis.verdict}</span>
            <span className="text-sm text-gray-500">({analysis.score}/100)</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{analysis.explanation}</p>
        </div>
      )}
    </div>
  );
}
