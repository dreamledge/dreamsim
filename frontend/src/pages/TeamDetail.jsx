import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, teamsCol, teamDoc, teamPlayersCol, teamPlayerDoc, leagueDoc } from '../lib/firestore';
import { generateLineupOptimization } from '../engine/aiEngine';

const POSITION_ELIGIBILITY = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

const POSITION_SLOT = { 0: 'PG', 1: 'SG', 2: 'SF', 3: 'PF', 4: 'C' };
const POSITION_INDEX = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

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
  const [selectedStarter, setSelectedStarter] = useState(null);
  const [swapAnim, setSwapAnim] = useState({});
  const [swapping, setSwapping] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const teamSnap = await getDoc(teamDoc(id));
        if (!teamSnap.exists()) { setLoading(false); return; }
        const t = { id: teamSnap.id, ...teamSnap.data() };
        setTeam(t);

        const pSnap = await getDocs(query(teamPlayersCol(id), where('seasonId', '==', t.seasonId || 1)));
        let loadedPlayers = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        let working = loadedPlayers.map(p => ({ ...p }));
        const taken = new Set();
        working = working.map(p => {
          if (!p.isStarter || p.lineupPosition === null || p.lineupPosition === undefined) return { ...p, isStarter: 0, lineupPosition: null };
          const pos = p.primaryPosition || p.position;
          const eligible = pos ? (POSITION_ELIGIBILITY[pos] || []) : [];
          const slotPos = POSITION_SLOT[p.lineupPosition];
          if (slotPos && eligible.includes(slotPos) && !taken.has(p.lineupPosition)) {
            taken.add(p.lineupPosition);
            return p;
          }
          const preferred = pos ? POSITION_INDEX[pos] : undefined;
          if (preferred !== undefined && !taken.has(preferred)) { taken.add(preferred); return { ...p, lineupPosition: preferred }; }
          const free = eligible.find(e => { const i = POSITION_INDEX[e]; return i !== undefined && !taken.has(i); });
          if (free !== undefined) { taken.add(POSITION_INDEX[free]); return { ...p, lineupPosition: POSITION_INDEX[free] }; }
          return { ...p, isStarter: 0, lineupPosition: null };
        });
        let starters = working.filter(p => p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));
        if (starters.length > 5) {
          const keep = new Set(starters.slice(0, 5).map(p => p.id));
          working = working.map(p => keep.has(p.id) ? p : { ...p, isStarter: 0, lineupPosition: null });
        }
        starters = working.filter(p => p.isStarter);
        if (starters.length < 5) {
          const bench = working.filter(p => !p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));
          const filled = new Set(starters.map(p => p.lineupPosition));
          for (let slot = 0; slot < 5; slot++) {
            if (filled.has(slot)) continue;
            const posName = POSITION_SLOT[slot];
            const idx = bench.findIndex(p => {
              const pos = p.primaryPosition || p.position;
              const e = pos ? (POSITION_ELIGIBILITY[pos] || []) : [];
              return e.includes(posName);
            });
            if (idx !== -1) {
              bench[idx].isStarter = 1;
              bench[idx].lineupPosition = slot;
              filled.add(slot);
            }
          }
          for (let slot = 0; slot < 5; slot++) {
            if (filled.has(slot)) continue;
            const idx = bench.findIndex(p => !p.isStarter);
            if (idx !== -1) {
              bench[idx].isStarter = 1;
              bench[idx].lineupPosition = slot;
              filled.add(slot);
            }
          }
        }
        const corrected = working;
        const hasChanges = corrected.some((p, i) => p.lineupPosition !== loadedPlayers[i].lineupPosition || p.isStarter !== loadedPlayers[i].isStarter);
        if (hasChanges) {
          for (const p of corrected) {
            const orig = loadedPlayers.find(o => o.id === p.id);
            if (orig && (orig.lineupPosition !== p.lineupPosition || orig.isStarter !== p.isStarter)) {
              updateDoc(teamPlayerDoc(id, p.id), { lineupPosition: p.lineupPosition, isStarter: p.isStarter }).catch(() => {});
            }
          }
        }
        setPlayers(corrected);

        if (t.leagueId) {
          const lSnap = await getDoc(leagueDoc(t.leagueId));
          if (lSnap.exists()) setLeague({ id: lSnap.id, ...lSnap.data() });
        }

        try {
          const gameSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', t.leagueId), orderBy('seasonNumber', 'desc'), limit(1)));
          if (!gameSnap.empty) {
            const s = gameSnap.docs[0];
            const gSnap = await getDocs(collection(db, 'seasons', s.id, 'games'));
            const allGames = gSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.homeTeamId === id || g.awayTeamId === id);
            setGames(allGames);
          }
        } catch (e) { console.error('games query:', e); }
      } catch (err) {
        console.error('TeamDetail load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const optimizeLineup = () => {
    setLineupOptimization(generateLineupOptimization(players));
  };

  const handleSwapPlayers = async (starter, benchPlayer) => {
    if (swapping || !starter || !benchPlayer) return;

    const benchPos = benchPlayer.primaryPosition || benchPlayer.position;
    const starterPosName = starter.primaryPosition || starter.position;
    const eligible = benchPlayer.canPlay || POSITION_ELIGIBILITY[benchPos] || [];
    if (!eligible.includes(starterPosName)) {
      setModalMessage(`${benchPlayer.firstName} ${benchPlayer.lastName} (${benchPos}) can't play ${starterPosName}. Positions can only overlap by one spot up or down.`);
      setShowPositionModal(true);
      setSelectedStarter(null);
      return;
    }

    setSwapping(true);
    setSwapAnim({ [starter.id]: true, [benchPlayer.id]: true });

    const starterPos = starter.lineupPosition;

    const updated = players.map(p => {
      if (p.id === starter.id) return { ...p, isStarter: 0, lineupPosition: null };
      if (p.id === benchPlayer.id) return { ...p, isStarter: 1, lineupPosition: starterPos };
      return p;
    });
    setPlayers(updated);
    setSelectedStarter(null);

    try {
      await updateDoc(teamPlayerDoc(id, starter.id), { isStarter: 0, lineupPosition: null });
      await updateDoc(teamPlayerDoc(id, benchPlayer.id), { isStarter: 1, lineupPosition: starterPos });
    } catch (err) {
      console.error('Swap error:', err);
    }

    setTimeout(() => {
      setSwapAnim({});
      setSwapping(false);
    }, 500);
  };

  const tabs = [
    { key: 'roster', label: 'Roster' },
    { key: 'lineup', label: 'Lineup' },
    { key: 'ai', label: 'AI Tools' },
    { key: 'games', label: 'Games' },
  ];

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );
  if (!team) return <p className="text-[var(--text-tertiary)]">Team not found</p>;

  const starters = players.filter(p => p.isStarter).sort((a, b) => (a.lineupPosition || 0) - (b.lineupPosition || 0));
  const bench = players.filter(p => !p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));

  const teamOvr = players.length > 0 ? Math.round(players.reduce((s, p) => s + (p.overall || 0), 0) / players.length) : 0;

  return (
    <div className="space-y-4 stagger">
      <div className="glass-card p-5 relative overflow-hidden animate-fade-up" style={{background: `linear-gradient(135deg, ${team.primaryColor || '#111120'} 0%, ${team.primaryColor || '#111120'} 40%, var(--bg-card) 100%)`}}>
        <div className="absolute top-0 right-0 w-40 h-40 opacity-20 rounded-full blur-3xl" style={{background: team.secondaryColor || '#ff7b35'}} />
        <div className="flex items-center gap-4 relative">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold font-display text-white shadow-xl" style={{ backgroundColor: team.primaryColor || '#ff7b35', boxShadow: `0 8px 24px ${team.primaryColor || '#ff7b35'}44` }}>
            {team.abbreviation || team.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-3xl tracking-wider">{team.name}</h2>
            <p className="text-[var(--text-secondary)] text-sm">{team.arenaName || 'Home Arena'} · {team.wins || 0}W - {team.losses || 0}L</p>
          </div>
          <div className="text-right">
            <div className="rating-circle rating-circle-lg" style={{'--pct': `${teamOvr}%`} }>
              <span className="text-white">{teamOvr}</span>
            </div>
            <div className="stat-label mt-0.5">OVR</div>
          </div>
        </div>
      </div>

      {user?.id === team.userId && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 animate-fade-up" style={{animationDelay: '0.08s'}}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-white shadow-md'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="glass-card p-4 animate-fade-up" key="roster">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg tracking-wider">Roster</h3>
            <span className="text-xs text-[var(--text-tertiary)] font-medium">{players.length} players</span>
          </div>
          <div className="space-y-2">
            {players.sort((a, b) => (b.overall || 0) - (a.overall || 0)).map((player, i) => (
              <div key={player.id} className="flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:bg-[var(--bg-tertiary)] transition-all duration-200" style={{animationDelay: `${i * 0.04}s`}}>
                <div className="rating-circle rating-circle-sm" style={{'--pct': `${player.overall || 50}%`} }>
                  <span className="text-white text-xs">{player.overall || '-'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{player.firstName} {player.lastName}</p>
                    {player.isStarter ? <span className="text-[var(--accent-yellow)] text-xs drop-shadow-[0_0_4px_rgba(241,196,15,0.4)]">★</span> : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded text-xs font-medium">{player.position}</span>
                    <span>{player.age} yrs</span>
                    <span>{(player.potential || 0) > 75 ? '⭐ High potential' : ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-display tracking-wide">{(player.statsPpg?.toFixed(1) || '-')}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{(player.statsRpg?.toFixed(1) || '-')} RPG</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'lineup' && (
        <div className="space-y-3 animate-fade-up" key="lineup">
          <div className="glass-card p-4">
            <h3 className="font-display text-lg tracking-wider mb-3">
              <span className="text-[var(--accent-orange)]">★</span> Starters
            </h3>
            <div className="space-y-2">
              {starters.map((p, i) => {
                const isSelected = selectedStarter?.id === p.id;
                return (
                  <div key={p.id} onClick={() => {
                    if (swapping) return;
                    setSelectedStarter(isSelected ? null : p);
                  }} className={`flex items-center gap-3 bg-[var(--bg-secondary)] border rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-[var(--accent-orange)] shadow-[0_0_12px_rgba(255,123,53,0.3)]'
                      : 'border-[var(--border-subtle)]'
                  } ${swapAnim[p.id] ? 'animate-swap' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm transition-colors duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#e83a4b] to-[#ff7b35] scale-110'
                        : 'bg-gradient-to-br from-[#ff7b35] to-[#e83a4b]'
                    }`}>{i + 1}</div>
                    <div className="rating-circle rating-circle-sm" style={{'--pct': `${p.overall || 50}%`} }>
                      <span className="text-white text-xs">{p.overall || '-'}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.position}</span>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] font-medium">{p.statsPpg?.toFixed(1) || '-'} PPG</div>
                  </div>
                );
              })}
              {starters.length === 0 && <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">No starters set</p>}
            </div>
          </div>
          {bench.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="font-display text-lg tracking-wider mb-3">Bench ({bench.length})</h3>
              <div className="space-y-1">
                {bench.map(p => (
                  <div key={p.id} onClick={() => {
                    if (selectedStarter && !swapping) {
                      handleSwapPlayers(selectedStarter, p);
                    }
                  }} className={`flex items-center justify-between py-2 px-2 rounded-lg transition-all duration-200 ${
                    selectedStarter ? 'cursor-pointer hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--accent-orange)]/30' : 'hover:bg-[var(--bg-secondary)]'
                  } ${swapAnim[p.id] ? 'animate-swap' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-tertiary)]">{p.position}</span>
                      <span className="text-sm">{p.firstName} {p.lastName}</span>
                    </div>
                    <span className="text-sm text-[var(--text-secondary)] font-medium">OVR {p.overall}</span>
                  </div>
                ))}
              </div>
              {selectedStarter && (
                <p className="text-xs text-[var(--accent-orange)] text-center mt-2 animate-fade-up">Tap a bench player to swap with {selectedStarter.firstName} {selectedStarter.lastName}</p>
              )}
            </div>
          )}
          <button onClick={optimizeLineup} className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            AI Optimize Lineup
          </button>
          {lineupOptimization && (
            <div className="glass-card p-4 accent-stripe-blue animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge badge-ai">AI</span>
                <h3 className="font-display text-lg tracking-wider">Optimized Lineup</h3>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Rating:</span>
                <span className="font-display text-2xl text-[var(--accent-blue)]">{lineupOptimization.rating}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                {lineupOptimization.starters?.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span>{p.position} - {p.firstName} {p.lastName}</span>
                    </div>
                    <span className="text-[var(--text-secondary)]">OVR {p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-3 animate-fade-up" key="ai">
          <button onClick={optimizeLineup} className="btn-ghost w-full py-3 text-sm flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            AI Lineup Optimizer
          </button>
          {lineupOptimization && (
            <div className="glass-card p-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge badge-ai">AI</span>
                <h3 className="font-display text-lg tracking-wider">Lineup Optimizer</h3>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Rating:</span>
                <span className="font-display text-2xl text-[var(--accent-blue)]">{lineupOptimization.rating}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                {lineupOptimization.starters?.map((p, i) => (
                  <div key={i} className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                    <span>{p.position} - {p.firstName} {p.lastName}</span>
                    <span className="text-[var(--text-secondary)]">OVR {p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'games' && (
        <div className="glass-card p-4 animate-fade-up" key="games">
          <h3 className="font-display text-lg tracking-wider mb-3">Recent Games</h3>
          {games.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">No games played yet. Sim a week to get started!</p>
          ) : (
            <div className="space-y-2">
              {games.slice(-10).reverse().map((game, i) => {
                const isHome = game.homeTeamId === id;
                const won = game.isCompleted && ((isHome && game.homeScore > game.awayScore) || (!isHome && game.awayScore > game.homeScore));
                return (
                  <div key={game.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3.5 hover:bg-[var(--bg-tertiary)] transition-colors" style={{animationDelay: `${i * 0.04}s`}}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${won ? 'text-[var(--accent-teal)]' : 'text-[var(--text-secondary)]'}`}>
                          {isHome ? 'vs' : '@'} {isHome ? game.awayTeamId?.slice(0, 8) || 'Opp' : game.homeTeamId?.slice(0, 8) || 'Opp'}
                        </span>
                      </div>
                      {game.isCompleted ? (
                        <div className="flex items-center gap-2 px-3">
                          <span className={`font-display text-xl ${game.homeScore > game.awayScore ? 'text-[var(--accent-teal)]' : 'text-[var(--text-tertiary)]'}`}>{game.homeScore}</span>
                          <span className="text-[var(--text-tertiary)] text-xs">-</span>
                          <span className={`font-display text-xl ${game.awayScore > game.homeScore ? 'text-[var(--accent-teal)]' : 'text-[var(--text-tertiary)]'}`}>{game.awayScore}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)] font-medium px-3">VS</span>
                      )}
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-[var(--text-tertiary)]">W{game.week}</span>
                        {won && <span className="ml-2 text-[var(--accent-teal)] text-xs">W</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowPositionModal(false); setSelectedStarter(null); }}>
          <div className="glass-card p-6 w-full max-w-sm animate-scale-in space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <h3 className="font-display text-xl tracking-wider">Position Mismatch</h3>
              <p className="text-sm text-[var(--text-secondary)]">{modalMessage}</p>
            </div>
            <button onClick={() => { setShowPositionModal(false); setSelectedStarter(null); }} className="btn-glow w-full py-2.5 text-sm">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
