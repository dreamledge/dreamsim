import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamDoc, teamPlayersCol, leagueDoc } from '../lib/firestore';
import { draftPlayers, createPlayer } from '../engine/gameEngine';
import { generateLineupOptimization, generateDraftRecommendation } from '../engine/aiEngine';

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

export default function TeamDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [league, setLeague] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');
  const [lineupOptimization, setLineupOptimization] = useState(null);
  const [draftRec, setDraftRec] = useState(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const teamSnap = await getDoc(teamDoc(id));
      if (!teamSnap.exists()) return;
      const t = { id: teamSnap.id, ...teamSnap.data() };
      setTeam(t);

      const pSnap = await getDocs(query(teamPlayersCol(id), where('seasonId', '==', t.seasonId || 1)));
      setPlayers(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (t.leagueId) {
        const lSnap = await getDoc(leagueDoc(t.leagueId));
        if (lSnap.exists()) setLeague({ id: lSnap.id, ...lSnap.data() });
      }

      const gameSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', t.leagueId), orderBy('seasonNumber', 'desc'), limit(1)));
      if (!gameSnap.empty) {
        const s = gameSnap.docs[0];
        const gSnap = await getDocs(collection(db, 'seasons', s.id, 'games'));
        const allGames = gSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.homeTeamId === id || g.awayTeamId === id);
        setGames(allGames);
      }

      setLoading(false);
    };
    load();
  }, [id]);

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const newPlayers = draftPlayers(5);
      for (const p of newPlayers) {
        const pId = uid();
        await setDoc(doc(teamPlayersCol(id), pId), {
          ...p, teamId: id, seasonId: team.seasonId || 1,
          isStarter: players.length + newPlayers.indexOf(p) < 5 ? 1 : 0,
          lineupPosition: players.length + newPlayers.indexOf(p) < 5 ? players.length + newPlayers.indexOf(p) : null,
        });
        await setDoc(doc(db, 'players', p.id), { ...p, teamId: id });
      }
      alert(`Drafted ${newPlayers.length} new players!`);
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
    setDrafting(false);
  };

  const optimizeLineup = () => {
    setLineupOptimization(generateLineupOptimization(players));
  };

  const getDraftRec = () => {
    const allPlayers = JSON.parse(sessionStorage.getItem('availablePlayers') || '[]');
    setDraftRec(generateDraftRecommendation(allPlayers, players));
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;
  if (!team) return <p className="text-gray-500">Team not found</p>;

  const starters = players.filter(p => p.isStarter).sort((a, b) => (a.lineupPosition || 0) - (b.lineupPosition || 0));
  const bench = players.filter(p => !p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: team.primaryColor || '#1a1a2e' }}>
            {team.abbreviation || team.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{team.name}</h2>
            <p className="text-gray-500 text-sm">{team.arenaName || 'Home Arena'} · {team.wins || 0}W - {team.losses || 0}L</p>
          </div>
        </div>
      </div>

      {user?.id === team.userId && (
        <div className="flex gap-2 text-sm">
          {['roster', 'lineup', 'ai', 'games', 'draft'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg capitalize ${activeTab === tab ? 'bg-[#e94560] text-white' : 'bg-[#16213e] text-gray-400'}`}>
              {tab === 'roster' ? 'Roster' : tab === 'lineup' ? 'Lineup' : tab === 'ai' ? 'AI Tools' : tab === 'draft' ? 'Draft' : 'Games'}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-3">Roster ({players.length})</h3>
          <div className="space-y-2">
            {players.sort((a, b) => (b.overall || 0) - (a.overall || 0)).map(player => (
              <div key={player.id} className="flex items-center gap-3 bg-[#1a1a2e] rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">{player.position}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{player.firstName} {player.lastName} {player.isStarter ? <span className="text-xs text-yellow-500">★</span> : ''}</p>
                  <p className="text-xs text-gray-500">OVR {player.overall} · {player.age} yrs</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{player.statsPpg?.toFixed(1) || '-'} PPG</p>
                  <p className="text-xs text-gray-500">{player.statsRpg?.toFixed(1) || '-'} RPG</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'lineup' && (
        <div className="space-y-3">
          <div className="bg-[#16213e] rounded-xl p-4">
            <h3 className="font-semibold mb-3">Starters</h3>
            <div className="space-y-2">
              {starters.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-[#1a1a2e] rounded-lg p-3">
                  <span className="w-5 text-center text-gray-500 text-sm">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">{p.position}</div>
                  <div className="flex-1"><p className="text-sm">{p.firstName} {p.lastName}</p><p className="text-xs text-gray-500">OVR {p.overall}</p></div>
                </div>
              ))}
            </div>
          </div>
          {bench.length > 0 && (
            <div className="bg-[#16213e] rounded-xl p-4">
              <h3 className="font-semibold mb-3">Bench ({bench.length})</h3>
              <div className="space-y-1 text-sm">
                {bench.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5">
                    <span>{p.position} {p.firstName} {p.lastName}</span>
                    <span className="text-gray-500">OVR {p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={optimizeLineup} className="w-full bg-gray-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-600 transition">🔄 AI Optimize Lineup</button>
          {lineupOptimization && (
            <div className="bg-[#16213e] rounded-xl p-4">
              <h3 className="font-semibold mb-2">🤖 Optimized Lineup</h3>
              <p className="text-sm text-gray-400">Rating: {lineupOptimization.rating}</p>
              <div className="mt-2 space-y-1 text-sm">
                {lineupOptimization.starters?.map((p, i) => (
                  <p key={i} className="text-gray-300">{p.position} - {p.firstName} {p.lastName} (OVR {p.overall})</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-3">
          <button onClick={getDraftRec} className="w-full bg-gray-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-600 transition">🎯 AI Draft Recommendations</button>
          <button onClick={optimizeLineup} className="w-full bg-gray-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-600 transition">📊 AI Lineup Optimizer</button>
          {draftRec && (
            <div className="bg-[#16213e] rounded-xl p-4">
              <h3 className="font-semibold mb-2">🎯 Draft Recommendations</h3>
              <div className="space-y-2">
                {draftRec.recommendations?.slice(0, 5).map((r, i) => (
                  <div key={i} className="bg-[#1a1a2e] rounded-lg p-2 text-sm">
                    <p className="font-medium">{r.player?.firstName} {r.player?.lastName} - {r.player?.position}</p>
                    <p className="text-xs text-gray-500">OVR {r.player?.overall} · Fit: {r.fitScore}%</p>
                    <p className="text-xs text-[#e94560]">{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lineupOptimization && (
            <div className="bg-[#16213e] rounded-xl p-4">
              <h3 className="font-semibold mb-2">📊 Lineup Optimizer</h3>
              <p className="text-sm text-gray-400">Rating: <span className="text-white font-bold">{lineupOptimization.rating}</span></p>
              <div className="mt-2 space-y-1 text-sm">
                {lineupOptimization.starters?.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{p.position} - {p.firstName} {p.lastName}</span>
                    <span className="text-gray-500">OVR {p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="space-y-3">
          <button onClick={handleDraft} disabled={drafting} className="w-full bg-[#e94560] text-white rounded-lg py-3 font-semibold hover:bg-[#d63851] transition disabled:opacity-50">
            {drafting ? 'Drafting...' : '✍️ Draft 5 New Players'}
          </button>
          <div className="bg-[#16213e] rounded-xl p-4">
            <h3 className="font-semibold mb-2">Draft Rules</h3>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Each draft gives you 5 new players</li>
              <li>• Max roster size is 15 players</li>
              <li>• Players have random attributes and potential</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-3">Recent Games</h3>
          {games.length === 0 ? (
            <p className="text-sm text-gray-500">No games played yet. Sim a week to get started!</p>
          ) : (
            <div className="space-y-2">
              {games.slice(-10).reverse().map(game => {
                const isHome = game.homeTeamId === id;
                return (
                  <div key={game.id} className="bg-[#1a1a2e] rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className={isHome && game.isCompleted ? (game.homeScore > game.awayScore ? 'font-bold text-green-400' : 'text-gray-400') : (!isHome && game.isCompleted ? (game.awayScore > game.homeScore ? 'font-bold text-green-400' : 'text-gray-400') : 'text-gray-400')}>
                        {game.homeTeamId === id ? 'vs' : '@'} {isHome ? game.awayTeamId || 'Opponent' : game.homeTeamId || 'Opponent'}
                      </span>
                      <span className="font-bold">{game.isCompleted ? `${game.homeScore} - ${game.awayScore}` : 'VS'}</span>
                      <span className="text-xs text-gray-500">Week {game.week}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


