import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leagueDoc, teamsCol, teamPlayersCol, teamPlayerDoc, draftsCol, draftDoc, draftPicksCol, draftPickDoc } from '../lib/firestore';
import { createPlayer } from '../engine/gameEngine';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const FIRST_NAMES = ['Jaylen','Marcus','Devin','Trae','Zion','Ja','Luka','Giannis','Steph','KD','Kyrie','Jayson','Jimmy','Bam','Donovan','Shai','Anthony','LaMelo','Cade','Scottie','Tyrese','Jalen','Herb','Paolo','Keegan','Jaden','Austin','RJ','Victor','Chet','Brandon','Darius','Franz','Jabari','Walker','Bennedict','Shaedon','Dyson','Jaden','Keegan'];
const LAST_NAMES = ['Williams','Johnson','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Garcia','Robinson','Clark','Lewis','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Turner','Hill','Adams','Baker','Carter','Evans','Foster','Green','Hughes','Jenkins','Kelly','Long','Mitchell'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateAvailablePlayers(count) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const pos = POSITIONS[i % 5];
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const p = createPlayer(fn, ln, pos, 19 + Math.floor(Math.random() * 5));
    players.push({ ...p, id: uid() });
  }
  return players;
}

function findWeakestPosition(players, available) {
  const posAvg = POSITIONS.map(pos => {
    const ps = players.filter(p => p.position === pos);
    const avg = ps.length > 0 ? ps.reduce((s, p) => s + (p.overall || 50), 0) / ps.length : 0;
    return { pos, avg };
  }).sort((a, b) => a.avg - b.avg);

  for (const { pos } of posAvg) {
    const match = available.filter(p => p.position === pos).sort((a, b) => (b.overall || 0) - (a.overall || 0));
    if (match.length > 0) return match[0];
  }
  return available.sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
}

export default function LeagueDraft() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [draft, setDraft] = useState(null);
  const [picks, setPicks] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  const [timeLeft, setTimeLeft] = useState(90);
  const [userTeam, setUserTeam] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const lSnap = await getDoc(leagueDoc(id));
        if (!lSnap.exists()) { navigate('/leagues'); return; }
        setLeague({ id: lSnap.id, ...lSnap.data() });

        const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
        const tData = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTeams(tData);
        setUserTeam(tData.find(t => t.userId === user?.id) || null);

        const dSnap = await getDocs(query(draftsCol(id), orderBy('createdAt', 'desc'), limit(1)));
        if (!dSnap.empty) {
          const d = { id: dSnap.docs[0].id, ...dSnap.docs[0].data() };
          setDraft(d);
          if (d.status === 'live' || d.status === 'completed') {
            loadPicks(d.id);
            if (d.status === 'live') loadPlayers(d.id);
          }
        }
      } catch (err) { console.error('load error:', err); }
      setLoading(false);
    };
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id]);

  const loadPicks = async (draftId) => {
    const pSnap = await getDocs(query(draftPicksCol(id, draftId), orderBy('order')));
    setPicks(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadPlayers = async (draftId) => {
    try {
      const pSnap = await getDocs(collection(db, 'leagues', id, 'drafts', draftId, 'players'));
      setAvailablePlayers(pSnap.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    } catch (e) { console.error('load players:', e); }
  };

  const subscribeDraft = () => {
    const dSnap = getDocs(query(draftsCol(id), orderBy('createdAt', 'desc'), limit(1)));
    return dSnap.then(snap => {
      if (!snap.empty) {
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setDraft(d);
        if (d.status === 'live') {
          loadPicks(d.id);
          loadPlayers(d.id);
        }
      }
    });
  };

  useEffect(() => {
    if (!draft || draft.status !== 'live') return;
    const unsubPicks = onSnapshot(query(draftPicksCol(id, draft.id), orderBy('order')), snap => {
      const p = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPicks(p);
    });
    const unsubDraft = onSnapshot(draftDoc(id, draft.id), snap => {
      if (snap.exists()) setDraft({ id: snap.id, ...snap.data() });
    });
    return () => { unsubPicks(); unsubDraft(); };
  }, [draft?.id, draft?.status]);

  useEffect(() => {
    if (!draft || draft.status !== 'live') { setTimeLeft(90); return; }
    const currentPick = picks.find(p => p.order === draft.currentPick);
    if (!currentPick || currentPick.status !== 'waiting') return;

    const started = draft.pickStartedAt ? new Date(draft.pickStartedAt).getTime() : Date.now();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const remaining = Math.max(0, 90 - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) handleAutoPick(currentPick);
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [draft?.currentPick, draft?.pickStartedAt, picks.length, draft?.status]);

  const handleSchedule = async () => {
    if (!scheduledTime) return;
    const dId = uid();
    await setDoc(draftDoc(id, dId), {
      status: 'scheduled',
      scheduledTime: new Date(scheduledTime).toISOString(),
      currentPick: 0,
      totalPicks: 0,
      pickTimeLimit: 90,
      pickStartedAt: null,
      totalRounds: 3,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      leagueId: id,
    });
    setDraft({ id: dId, status: 'scheduled', currentPick: 0, totalPicks: 0, totalRounds: 3 });
  };

  const handleStartDraft = async () => {
    if (!draft) return;
    const teamIds = shuffle(teams);
    const totalPicks = teamIds.length * 3;
    const dId = draft.id;

    const batch = [];
    let order = 0;
    for (let r = 1; r <= 3; r++) {
      const roundTeams = r % 2 === 1 ? teamIds : [...teamIds].reverse();
      for (const t of roundTeams) {
        order++;
        batch.push({
          order,
          round: r,
          teamId: t.id,
          teamName: t.name,
          playerId: null,
          playerName: null,
          status: 'waiting',
          pickedAt: null,
        });
      }
    }

    for (const p of batch) {
      const pId = uid();
      await setDoc(draftPickDoc(id, dId, pId), p);
    }

    const players = generateAvailablePlayers(totalPicks);
    for (const p of players) {
      await setDoc(doc(collection(db, 'leagues', id, 'drafts', dId, 'players'), p.id), p);
    }

    await updateDoc(draftDoc(id, dId), {
      status: 'live',
      currentPick: 1,
      totalPicks,
      pickStartedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    });

    await subscribeDraft();
  };

  const handlePick = async (player) => {
    if (!draft || !player) return;
    const currentPick = picks.find(p => p.order === draft.currentPick);
    if (!currentPick) return;

    const pickId = currentPick.id;
    await updateDoc(draftPickDoc(id, draft.id, pickId), {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      status: 'picked',
      pickedAt: new Date().toISOString(),
    });

    try {
      await deleteDoc(doc(db, 'leagues', id, 'drafts', draft.id, 'players', player.firestoreId || player.id));
    } catch (e) {}

    const nextPick = draft.currentPick + 1;
    if (nextPick > draft.totalPicks) {
      await updateDoc(draftDoc(id, draft.id), {
        status: 'completed',
        currentPick: nextPick,
        completedAt: new Date().toISOString(),
      });
      await saveDraftedPlayers();
    } else {
      await updateDoc(draftDoc(id, draft.id), {
        currentPick: nextPick,
        pickStartedAt: new Date().toISOString(),
      });
    }
  };

  const handleAutoPick = async (pick) => {
    if (!draft || !pick) return;
    if (pick.status !== 'waiting') return;

    const team = teams.find(t => t.id === pick.teamId);
    if (!team) return;

    let roster = team.players || [];
    if (!roster.length) {
      const pSnap = await getDocs(teamPlayersCol(team.id));
      roster = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const availSnap = await getDocs(collection(db, 'leagues', id, 'drafts', draft.id, 'players'));
    const avail = availSnap.docs.map(d => ({ ...d.data(), firestoreId: d.id }));

    if (avail.length === 0) {
      await updateDoc(draftDoc(id, draft.id), {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      await saveDraftedPlayers();
      return;
    }

    const best = findWeakestPosition(roster, avail);
    if (!best) return;

    const pickId = pick.id;
    await updateDoc(draftPickDoc(id, draft.id, pickId), {
      playerId: best.id,
      playerName: `${best.firstName} ${best.lastName}`,
      status: 'auto',
      pickedAt: new Date().toISOString(),
    });

    try {
      await deleteDoc(doc(db, 'leagues', id, 'drafts', draft.id, 'players', best.firestoreId || best.id));
    } catch (e) {}

    const nextPick = draft.currentPick + 1;
    if (nextPick > draft.totalPicks) {
      await updateDoc(draftDoc(id, draft.id), {
        status: 'completed',
        currentPick: nextPick,
        completedAt: new Date().toISOString(),
      });
      await saveDraftedPlayers();
    } else {
      await updateDoc(draftDoc(id, draft.id), {
        currentPick: nextPick,
        pickStartedAt: new Date().toISOString(),
      });
    }
  };

  const saveDraftedPlayers = async () => {
    const allPicks = [...picks];
    const dSnap = await getDocs(query(draftPicksCol(id, draft.id), orderBy('order')));
    const finalPicks = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const pick of finalPicks) {
      if (!pick.playerId || pick.status === 'waiting') continue;
      const team = teams.find(t => t.id === pick.teamId);
      if (!team) continue;

      const pSnap = await getDocs(teamPlayersCol(team.id));
      const existing = pSnap.docs.length;

      const playerData = { ...pick };
      delete playerData.id;
      delete playerData.order;
      delete playerData.round;
      delete playerData.teamId;
      delete playerData.teamName;
      delete playerData.playerId;
      delete playerData.playerName;
      delete playerData.status;
      delete playerData.pickedAt;

      const pId = pick.playerId;
      await setDoc(doc(teamPlayersCol(team.id), pId), {
        id: pId,
        firstName: pick.playerName?.split(' ')[0] || 'Player',
        lastName: pick.playerName?.split(' ').slice(1).join(' ') || 'Unknown',
        position: POSITIONS[finalPicks.indexOf(pick) % 5],
        overall: 50 + Math.floor(Math.random() * 35),
        age: 19 + Math.floor(Math.random() * 7),
        teamId: team.id,
        seasonId: league?.currentSeason || 1,
        isStarter: existing < 5 ? 1 : 0,
        lineupPosition: existing < 5 ? existing : null,
      });
    }
  };

  const isCommissioner = league?.commissionerId === user?.id;
  const currentPick = picks.find(p => p.order === draft?.currentPick);
  const isMyTurn = currentPick && userTeam && currentPick.teamId === userTeam.id;
  const draftedIds = picks.filter(p => p.status === 'picked' || p.status === 'auto').map(p => p.playerId);
  const undraftedPlayers = availablePlayers.filter(p => !draftedIds.includes(p.id));

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  const renderSetup = () => (
    <div className="space-y-4 animate-fade-up">
      <h2 className="font-display text-3xl tracking-wider">Draft Setup</h2>
      {isCommissioner ? (
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Schedule Draft Date & Time</label>
            <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] transition-all" />
          </div>
          <button onClick={handleSchedule} disabled={!scheduledTime}
            className="btn-glow w-full py-2.5 text-sm disabled:opacity-50">Schedule Draft</button>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-2">
            <h3 className="font-display text-sm tracking-wider">Draft Settings</h3>
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>• 3 rounds, snake order</p>
              <p>• 90 seconds per pick</p>
              <p>• CPU auto-picks for absent teams</p>
              <p>• {teams.length} teams participating</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">The commissioner hasn't scheduled a draft yet.</p>
        </div>
      )}
    </div>
  );

  const renderScheduled = () => (
    <div className="space-y-4 animate-fade-up">
      <h2 className="font-display text-3xl tracking-wider">Draft Scheduled</h2>
      <div className="glass-card p-5 text-center space-y-4">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p className="text-sm text-[var(--text-secondary)]">Scheduled for</p>
        <p className="font-display text-xl tracking-wider">{draft?.scheduledTime ? new Date(draft.scheduledTime).toLocaleString() : 'TBD'}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Commissioner will start the draft when ready</p>
        {isCommissioner && (
          <button onClick={handleStartDraft} className="btn-glow px-8 py-2.5 text-sm">Start Draft Now</button>
        )}
      </div>
    </div>
  );

  const renderLive = () => (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">Live Draft</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">Pick {draft?.currentPick}/{draft?.totalPicks}</span>
        </div>
      </div>

      <div className="glass-card p-5 text-center animate-scale-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[var(--accent-orange)]/10 to-transparent rounded-full blur-3xl" />
        <div className="relative z-10">
          {currentPick ? (
            <>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Round {currentPick.round} &middot; Pick {currentPick.order}</p>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] flex items-center justify-center text-xl font-bold font-display text-white mx-auto mb-2 shadow-lg">
                {currentPick.teamName?.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="font-display text-xl tracking-wider">{currentPick.teamName}</h3>
              {currentPick.status === 'waiting' ? (
                <>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {isMyTurn ? 'Your turn to pick!' : `${isCommissioner ? 'Awaiting pick...' : 'Waiting for pick...'}`}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-orange)] flex items-center justify-center font-display text-lg font-bold" style={{color: timeLeft <= 10 ? '#ef4444' : 'var(--accent-orange)'}}>
                      {timeLeft}
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">sec</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--accent-green)] mt-2 flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Selected: {currentPick.playerName}
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--text-tertiary)]">Draft in progress...</p>
          )}
        </div>
      </div>

      <div className="space-y-2 animate-slide-up">
        <h3 className="font-display text-base tracking-wider">Available Players</h3>
        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {undraftedPlayers.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 15).map((p, i) => (
            <div key={p.id}
              className={`glass-card p-3 flex items-center gap-3 transition-all duration-200 ${
                isMyTurn && currentPick?.status === 'waiting' ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : ''
              }`}
              onClick={() => { if (isMyTurn && currentPick?.status === 'waiting') handlePick(p); }}
              style={{animationDelay: `${i * 0.03}s`}}
            >
              <div className="rating-circle rating-circle-sm" style={{'--pct': `${p.overall || 50}%`}}>
                <span className="text-white text-xs">{p.overall || '-'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                <div className="flex gap-2 text-xs text-[var(--text-tertiary)]">
                  <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.position}</span>
                  <span>{p.age} yrs</span>
                  <span>{p.height}in</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-secondary)]">{p.offense || '-'} OFF</p>
                <p className="text-xs text-[var(--text-secondary)]">{p.defense || '-'} DEF</p>
              </div>
            </div>
          ))}
          {undraftedPlayers.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">All players have been drafted!</p>
          )}
        </div>
      </div>

      <div className="glass-card p-4 animate-slide-up">
        <h3 className="font-display text-base tracking-wider mb-3">Draft Board</h3>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {picks.filter(p => p.status === 'picked' || p.status === 'auto').map((p, i) => (
            <div key={p.order} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[var(--bg-secondary)]/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-tertiary)] w-6">#{p.order}</span>
                <span className="font-medium">{p.teamName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)]">{p.playerName}</span>
                <span className={`badge ${p.status === 'auto' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'} text-[10px] px-1.5`}>
                  {p.status === 'auto' ? 'AUTO' : 'PICK'}
                </span>
              </div>
            </div>
          ))}
          {picks.filter(p => p.status === 'picked' || p.status === 'auto').length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No picks yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderCompleted = () => (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Draft Complete</h2>
      <div className="glass-card p-5 text-center animate-scale-in">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><polyline points="20 6 9 17 4 12"/></svg>
        <p className="text-sm text-[var(--text-secondary)]">All {draft?.totalPicks} picks have been completed!</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Drafted players have been added to their teams.</p>
        <button onClick={() => navigate(`/leagues/${id}`)} className="btn-glow mt-4 px-6 py-2.5 text-sm">Back to League</button>
      </div>

      <div className="glass-card p-4 animate-slide-up">
        <h3 className="font-display text-base tracking-wider mb-3">Draft Results</h3>
        <div className="space-y-1">
          {picks.sort((a, b) => a.order - b.order).map((p, i) => (
            <div key={p.order} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors text-sm" style={{animationDelay: `${i * 0.03}s`}}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-tertiary)] w-5">#{p.order}</span>
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] flex items-center justify-center text-[10px] font-bold text-white">{p.teamName?.slice(0, 2).toUpperCase()}</div>
                <span className="font-medium text-xs">{p.teamName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)]">{p.playerName || '--'}</span>
                {p.status === 'auto' && <span className="text-[10px] text-yellow-400 bg-yellow-500/20 px-1.5 py-0.5 rounded">AUTO</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!draft) return renderSetup();
  if (draft.status === 'scheduled') return renderScheduled();
  if (draft.status === 'live') return renderLive();
  if (draft.status === 'completed') return renderCompleted();
  return renderSetup();
}
