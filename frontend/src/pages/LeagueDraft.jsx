import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, orderBy, limit, deleteDoc, collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leagueDoc, teamsCol, teamPlayersCol, teamPlayerDoc, draftsCol, draftDoc, draftPicksCol, draftPickDoc, nbaPoolDoc } from '../lib/firestore';
import { draftNbaPlayers, ensureNbaPool, getPoolSize, generateRookies } from '../engine/gameEngine';
import DraftDatePicker from '../components/DraftDatePicker';
import ScoutModal from '../components/ScoutModal';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const AI_TEAM_NAMES = ['Metro Spartans','Capital Titans','Bay Vipers','Coast Hawks','Summit Bears','Valley Kings','Prairie Wolves','Canyon Foxes','Lake Dragons','Ridge Eagles','Delta Sharks','Peak Lions'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function generateAvailablePlayers(count, isExpansion = false) {
  await ensureNbaPool();
  const nbaPlayers = await draftNbaPlayers(count);

  if (!isExpansion) {
    const rookieCount = Math.ceil(count * 0.25);
    const rookies = generateRookies(rookieCount);
    return [...nbaPlayers, ...rookies];
  }

  return nbaPlayers;
}

const POSITION_ELIGIBILITY = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

function isEligible(player, slot) {
  const eligible = POSITION_ELIGIBILITY[player.primaryPosition || player.position] || ['PG', 'SG', 'SF', 'PF', 'C'];
  return eligible.includes(slot);
}

const LOTTERY_ODDS = [
  { seed: 1, combinations: 140 },
  { seed: 2, combinations: 140 },
  { seed: 3, combinations: 140 },
  { seed: 4, combinations: 125 },
  { seed: 5, combinations: 105 },
  { seed: 6, combinations: 90 },
  { seed: 7, combinations: 75 },
  { seed: 8, combinations: 60 },
  { seed: 9, combinations: 45 },
  { seed: 10, combinations: 30 },
  { seed: 11, combinations: 20 },
  { seed: 12, combinations: 15 },
  { seed: 13, combinations: 10 },
  { seed: 14, combinations: 5 },
];

function generateLotteryOrder(teamList) {
  if (teamList.length === 0) return [];

  const allZeroWins = teamList.every(t => !t.wins);
  if (allZeroWins) return shuffle(teamList);

  const sorted = [...teamList].sort((a, b) => (a.wins || 0) - (b.wins || 0));

  if (sorted.length <= 4) {
    return shuffle(sorted);
  }

  const lotteryTeams = sorted.slice(0, Math.min(14, sorted.length));
  const nonLotteryTeams = sorted.slice(Math.min(14, sorted.length));

  const oddsToUse = LOTTERY_ODDS.slice(0, lotteryTeams.length);

  let combinationPool = [];
  for (const { seed, combinations } of oddsToUse) {
    const teamIndex = seed - 1;
    if (teamIndex < lotteryTeams.length) {
      for (let i = 0; i < combinations; i++) {
        combinationPool.push(lotteryTeams[teamIndex]);
      }
    }
  }

  const drawn = [];
  const remainingCombinations = [...combinationPool];

  for (let pick = 0; pick < 4 && remainingCombinations.length > 0; pick++) {
    const winnerIndex = Math.floor(Math.random() * remainingCombinations.length);
    const winner = remainingCombinations[winnerIndex];
    drawn.push(winner);

    for (let i = remainingCombinations.length - 1; i >= 0; i--) {
      if (remainingCombinations[i].id === winner.id) {
        remainingCombinations.splice(i, 1);
      }
    }

    const lotteryIdx = lotteryTeams.findIndex(t => t.id === winner.id);
    if (lotteryIdx !== -1) lotteryTeams.splice(lotteryIdx, 1);
  }

  const remainingLottery = lotteryTeams.reverse();

  return [...drawn, ...remainingLottery, ...nonLotteryTeams];
}

function findWeakestPosition(players, available) {
  const slotCoverage = {};
  for (const slot of POSITIONS) {
    slotCoverage[slot] = players.filter(p => isEligible(p, slot)).length;
  }
  const sorted = Object.entries(slotCoverage).sort(([, a], [, b]) => a - b);

  for (const [slot] of sorted) {
    const match = available.filter(p => isEligible(p, slot)).sort((a, b) => (b.overall || 0) - (a.overall || 0));
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
  const [season, setSeason] = useState(null);
  const [draft, setDraft] = useState(null);
  const [picks, setPicks] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(120);
  const [userTeam, setUserTeam] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [scoutPlayer, setScoutPlayer] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

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

        try {
          const sSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', id)));
          const seasonsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
          if (seasonsList.length > 0) setSeason(seasonsList[0]);
        } catch (e) { console.error('season query:', e); }

        const dSnap = await getDocs(query(draftsCol(id), orderBy('createdAt', 'desc'), limit(1)));
        if (!dSnap.empty) {
          const d = { id: dSnap.docs[0].id, ...dSnap.docs[0].data() };
          setDraft(d);
          if (d.status === 'scheduled' || d.status === 'joining' || d.status === 'live' || d.status === 'completed') {
            if (d.status !== 'completed') loadPlayers(d.id);
            if (d.status === 'joining' || d.status === 'live' || d.status === 'completed') loadPicks(d.id);
          }
        }
      } catch (err) { console.error('load error:', err); }
      setLoading(false);
    };
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
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
        if (d.status === 'scheduled' || d.status === 'joining') {
          loadPlayers(d.id);
        }
        if (d.status === 'joining') {
          loadPicks(d.id);
        }
        if (d.status === 'live') {
          loadPicks(d.id);
          loadPlayers(d.id);
        }
      }
    });
  };

  useEffect(() => {
    if (!draft || (draft.status !== 'joining' && draft.status !== 'live')) return;
    const unsubPicks = onSnapshot(query(draftPicksCol(id, draft.id), orderBy('order')), snap => {
      const p = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPicks(p);
    });
    const unsubDraft = onSnapshot(draftDoc(id, draft.id), snap => {
      if (snap.exists()) setDraft({ id: snap.id, ...snap.data() });
    });
    const unsubPlayers = onSnapshot(collection(db, 'leagues', id, 'drafts', draft.id, 'players'), snap => {
      setAvailablePlayers(snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });
    return () => { unsubPicks(); unsubDraft(); unsubPlayers(); };
  }, [draft?.id, draft?.status]);

  useEffect(() => {
    if (!draft || draft.status !== 'live') { setTimeLeft(120); return; }
    const currentPick = picks.find(p => p.order === draft.currentPick);
    if (!currentPick || currentPick.status !== 'waiting') return;

    let cancelled = false;
    const run = async () => {
      const teamSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
      const allTeams = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (cancelled) return;

      const team = allTeams.find(t => t.id === currentPick.teamId);
      const isAi = team && (team.isAi === 1 || team.userId === 'ai');
      const userHasJoined = team && draft?.joinedUsers?.includes(team.userId);
      if (isAi || (team && team.userId !== 'ai' && !userHasJoined)) {
        handleAutoPick();
        return;
      }

      const started = draft.pickStartedAt ? new Date(draft.pickStartedAt).getTime() : Date.now();
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const remaining = Math.max(0, 120 - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) handleAutoPick();
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    };
    run();
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [draft?.currentPick, draft?.pickStartedAt, picks.filter(p => p.status === 'waiting').length, draft?.status, draft?.joinedUsers]);

  useEffect(() => {
    if (!draft || draft.status !== 'scheduled' || !draft.scheduledTime) {
      setCountdown('');
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    const update = () => {
      const diff = new Date(draft.scheduledTime).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Draft is starting!'); if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [draft?.status, draft?.scheduledTime]);

  useEffect(() => {
    if (!draft || draft.status !== 'joining' || !draft.joinDeadline) {
      setCountdown('');
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    const update = () => {
      const diff = new Date(draft.joinDeadline).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Draft starting...');
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        updateDoc(draftDoc(id, draft.id), { status: 'live', pickStartedAt: new Date().toISOString() });
        return;
      }
      setCountdown(Math.ceil(diff / 1000) + 's');
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [draft?.status, draft?.joinDeadline]);

  const handleSchedule = async (scheduledDate) => {
    if (!scheduledDate) return;
    const dId = uid();

    let currentTeams = teams;
    if (league && teams.length < league.teamCount) {
      const missing = league.teamCount - teams.length;
      for (let i = 0; i < missing; i++) {
        const aiId = uid();
        const idx = teams.length + i;
        const name = AI_TEAM_NAMES[idx % AI_TEAM_NAMES.length];
        await setDoc(doc(db, 'teams', aiId), {
          name,
          abbreviation: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3),
          leagueId: id,
          userId: 'ai',
          primaryColor: '#1a1a2e',
          secondaryColor: '#e94560',
          arenaName: `${name} Arena`,
          seasonId: league?.currentSeason || 1,
          wins: 0, losses: 0,
          isAi: 1, prestige: 40 + Math.floor(Math.random() * 30),
          createdAt: new Date().toISOString(),
        });
      }
      const tSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
      currentTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(currentTeams);
      setUserTeam(currentTeams.find(t => t.userId === user?.id) || null);
    }

    let hasPlayers = false;
    try {
      if (currentTeams.length > 0) {
        const pSnap = await getDocs(query(teamPlayersCol(currentTeams[0].id), limit(1)));
        hasPlayers = !pSnap.empty;
      }
    } catch {}
    const totalRounds = hasPlayers ? 2 : 15;
    const totalPicks = currentTeams.length * totalRounds;

    await setDoc(draftDoc(id, dId), {
      status: 'scheduled',
      scheduledTime: scheduledDate.toISOString(),
      currentPick: 0,
      totalPicks,
      pickTimeLimit: 120,
      pickStartedAt: null,
      totalRounds,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      leagueId: id,
    });
    setDraft({ id: dId, status: 'scheduled', currentPick: 0, totalPicks, totalRounds });

    try {
      const count = totalRounds > 3 ? getPoolSize() : totalPicks;
      const players = await generateAvailablePlayers(count, totalRounds > 3);
      let batch = writeBatch(db);
      let opCount = 0;
      for (const p of players) {
        const ref = doc(collection(db, 'leagues', id, 'drafts', dId, 'players'), p.id || p.firestoreId || uid());
        batch.set(ref, p);
        opCount++;
        if (opCount >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
    } catch (e) { console.error('generate pool:', e); }

    loadPlayers(dId);
  };

  const handleStartDraft = async () => {
    if (!draft || isStarting) return;
    setIsStarting(true);
    try {
      const totalRounds = draft.totalRounds || 2;
      const orderSeed = totalRounds > 3 ? shuffle(teams) : generateLotteryOrder(teams);
      const totalPicks = teams.length * totalRounds;
      const dId = draft.id;

      const batch = [];
      let order = 0;
      for (let r = 1; r <= totalRounds; r++) {
        const roundTeams = r % 2 === 1 ? orderSeed : [...orderSeed].reverse();
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

      const localPicks = [];
      let pickBatch = writeBatch(db);
      let pickCount = 0;
      for (const p of batch) {
        const pId = uid();
        pickBatch.set(draftPickDoc(id, dId, pId), p);
        localPicks.push({ id: pId, ...p });
        pickCount++;
        if (pickCount >= 500) {
          await pickBatch.commit();
          pickBatch = writeBatch(db);
          pickCount = 0;
        }
      }
      if (pickCount > 0) await pickBatch.commit();
      setPicks(localPicks);

      // Players already saved in handleSchedule — only generate if pool is empty
      const pSnap = await getDocs(collection(db, 'leagues', id, 'drafts', dId, 'players'));
      if (pSnap.empty) {
        const count = totalRounds > 3 ? getPoolSize() : totalPicks;
        const players = await generateAvailablePlayers(count, totalRounds > 3);
        let poolBatch = writeBatch(db);
        let poolCount = 0;
        for (const p of players) {
          const ref = doc(collection(db, 'leagues', id, 'drafts', dId, 'players'), p.id || p.firestoreId || uid());
          poolBatch.set(ref, p);
          poolCount++;
          if (poolCount >= 500) {
            await poolBatch.commit();
            poolBatch = writeBatch(db);
            poolCount = 0;
          }
        }
        if (poolCount > 0) await poolBatch.commit();
      }

      await updateDoc(draftDoc(id, dId), {
        status: 'joining',
        currentPick: 1,
        totalPicks,
        pickStartedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        joinDeadline: new Date(Date.now() + 60000).toISOString(),
        joinedUsers: [],
      });

      await subscribeDraft();
    } finally {
      setIsStarting(false);
    }
  };

  const handleJoinDraft = async () => {
    if (!draft || !user) return;
    const joined = draft.joinedUsers || [];
    if (joined.includes(user.id)) return;
    await updateDoc(draftDoc(id, draft.id), {
      joinedUsers: [...joined, user.id],
    });
  };

  const handlePick = async (player) => {
    if (!draft || !player) return;
    const currentPick = picks.find(p => p.order === draft.currentPick);
    if (!currentPick) return;

    const pickId = currentPick.id;
    await updateDoc(draftPickDoc(id, draft.id, pickId), {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      playerData: { ...player },
      status: 'picked',
      pickedAt: new Date().toISOString(),
    });

    try {
      await deleteDoc(doc(db, 'leagues', id, 'drafts', draft.id, 'players', player.firestoreId || player.id));
    } catch (e) {}

    const draftSnap = await getDoc(draftDoc(id, draft.id));
    const freshDraft = draftSnap.data();
    const realTotalPicks = teams.length * (freshDraft?.totalRounds || 2);
    const nextPick = (freshDraft?.currentPick || draft.currentPick) + 1;
    if (nextPick > realTotalPicks) {
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

  const handleAutoPick = async () => {
    if (!draft) return;

    // Step 1: Read the CURRENT draft state directly from Firestore (no stale data)
    const draftSnap = await getDoc(draftDoc(id, draft.id));
    if (!draftSnap.exists()) return;
    const freshDraft = draftSnap.data();

    // Step 2: Read the current pick directly from Firestore
    const picksSnap = await getDocs(query(draftPicksCol(id, draft.id), orderBy('order')));
    const currentPick = picksSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .find(p => p.order === freshDraft.currentPick);

    // Step 3: If pick is already completed or missing, bail out silently
    if (!currentPick || currentPick.status !== 'waiting') return;

    // Step 4: Find the team for this pick from Firestore (use local teams as fallback)
    const team = teams.find(t => t.id === currentPick.teamId);
    if (!team) return;

    // Step 5: Get the team's existing roster for position analysis
    let roster = team.players || [];
    if (!roster.length) {
      const pSnap = await getDocs(teamPlayersCol(team.id));
      roster = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Step 6: Get available players from Firestore
    const availSnap = await getDocs(collection(db, 'leagues', id, 'drafts', draft.id, 'players'));
    const avail = availSnap.docs.map(d => ({ ...d.data(), firestoreId: d.id }));

    // Step 7: If no players remain, complete the draft
    if (avail.length === 0) {
      await updateDoc(draftDoc(id, draft.id), {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      await saveDraftedPlayers();
      return;
    }

    // Step 8: Pick the best player for the weakest position
    const best = findWeakestPosition(roster, avail);
    if (!best) return;

    // Step 9: Update the draft pick document
    const pickId = currentPick.id;
    await updateDoc(draftPickDoc(id, draft.id, pickId), {
      playerId: best.id,
      playerName: `${best.firstName} ${best.lastName}`,
      playerData: { ...best },
      status: 'auto',
      pickedAt: new Date().toISOString(),
    });

    // Step 10: Remove the drafted player from the pool
    try {
      await deleteDoc(doc(db, 'leagues', id, 'drafts', draft.id, 'players', best.firestoreId || best.id));
    } catch (e) {}

    // Step 11: Re-read draft state to calculate the real total picks and advance
    const draftSnap2 = await getDoc(draftDoc(id, draft.id));
    const freshDraft2 = draftSnap2.data();
    const realTotalPicks = teams.length * (freshDraft2?.totalRounds || 2);
    const nextPick = (freshDraft2?.currentPick || draft.currentPick) + 1;
    if (nextPick > realTotalPicks) {
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
    const dSnap = await getDocs(query(draftPicksCol(id, draft.id), orderBy('order')));
    const finalPicks = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const pick of finalPicks) {
      if (!pick.playerId || pick.status === 'waiting') continue;
      const team = teams.find(t => t.id === pick.teamId);
      if (!team) continue;

      const pSnap = await getDocs(teamPlayersCol(team.id));
      const existing = pSnap.docs.length;

      const pd = pick.playerData || {};

      await setDoc(doc(teamPlayersCol(team.id), pick.playerId), {
        id: pick.playerId,
        firstName: pd.firstName || pick.playerName?.split(' ')[0] || 'Player',
        lastName: pd.lastName || pick.playerName?.split(' ').slice(1).join(' ') || 'Unknown',
        primaryPosition: pd.primaryPosition || pd.position || 'SF',
        canPlay: pd.canPlay || ['PG', 'SG', 'SF', 'PF', 'C'],
        overall: pd.overall || 50,
        age: pd.age || 22,
        height: pd.height || 78,
        weight: pd.weight || 210,
        offense: pd.offense || 50,
        defense: pd.defense || 50,
        shooting: pd.shooting || 50,
        playmaking: pd.playmaking || 50,
        rebounding: pd.rebounding || 50,
        athleticism: pd.athleticism || 50,
        potential: pd.potential || 75,
        nbaTeam: pd.nbaTeam || null,
        statsPpg: pd.statsPpg || 0,
        statsRpg: pd.statsRpg || 0,
        statsApg: pd.statsApg || 0,
        statsSpg: pd.statsSpg || 0,
        statsBpg: pd.statsBpg || 0,
        statsFgPct: pd.statsFgPct || 0.45,
        statsThreePct: pd.statsThreePct || 0.33,
        teamId: team.id,
        seasonId: league?.currentSeason || 1,
        isStarter: existing < 5 ? 1 : 0,
        lineupPosition: existing < 5 ? existing : null,
        isRookie: pd.isRookie || false,
      });
    }
  };

  const isCommissioner = league?.commissionerId === user?.id;
  const seasonInProgress = season && (season.status === 'regular' || season.status === 'playoffs');
  const canSchedule = !season || season.status === 'pregame' || season.status === 'completed';
  const currentPick = picks.find(p => p.order === draft?.currentPick);
  const isMyTurn = currentPick && userTeam && currentPick.teamId === userTeam.id;
  const draftedIds = picks.filter(p => p.status === 'picked' || p.status === 'auto').map(p => p.playerId);
  const undraftedPlayers = availablePlayers.filter(p => !draftedIds.includes(p.id));
  const computedTotalPicks = teams.length * (draft?.totalRounds || 2);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  const renderSetup = () => (
    <div className="space-y-4 animate-fade-up">
      <h2 className="font-display text-3xl tracking-wider">Draft Setup</h2>

      {seasonInProgress && isCommissioner && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>The season is in progress (Week {season?.currentWeek}/{season?.totalWeeks}). Drafting mid-season will add players immediately.</span>
        </div>
      )}

      {!isCommissioner ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          {seasonInProgress ? (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-sm text-[var(--text-secondary)]">The season is in progress. The commissioner can schedule a draft at any time.</p>
            </>
          ) : (
            <p className="text-[var(--text-secondary)]">The commissioner hasn't scheduled a draft yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <DraftDatePicker onSchedule={handleSchedule} />
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-2">
            <h3 className="font-display text-sm tracking-wider">Draft Settings</h3>
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>• {draft?.totalRounds > 3 ? '15 rounds (expansion)' : `${draft?.totalRounds || 2} rounds`}, snake order</p>
              <p>• 120 seconds per pick</p>
              <p>• CPU auto-picks for absent teams</p>
              <p>• {teams.length} teams participating</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderScheduled = () => (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Draft Scheduled</h2>

      <div className="glass-card p-5 text-center space-y-4 animate-scale-in">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p className="text-sm text-[var(--text-secondary)]">Scheduled for</p>
        <p className="font-display text-xl tracking-wider">{draft?.scheduledTime ? new Date(draft.scheduledTime).toLocaleString() : 'TBD'}</p>
        {countdown && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="text-2xl font-display font-bold tracking-widest text-[var(--accent-orange)]">{countdown}</div>
          </div>
        )}
        <p className="text-xs text-[var(--text-tertiary)]">Commissioner will start the draft when ready</p>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-3 text-xs text-[var(--text-secondary)] space-y-1">
          <p>• {draft?.totalRounds > 3 ? '15 rounds (expansion)' : `${draft?.totalRounds || 2} rounds`}, snake order</p>
          <p>• 120 seconds per pick</p>
          <p>• CPU auto-picks for absent teams</p>
          <p>• {undraftedPlayers.length} players in the pool</p>
          <p>• {teams.length} teams participating</p>
        </div>
        {isCommissioner && (
          <button onClick={handleStartDraft} disabled={isStarting} className={`px-8 py-2.5 text-sm ${isStarting ? 'btn-disabled opacity-50 cursor-not-allowed' : 'btn-glow'}`}>
            {isStarting ? 'Starting Draft...' : 'Start Draft Now'}
          </button>
        )}
      </div>

      {undraftedPlayers.length > 0 && (
        <div className="space-y-2 animate-slide-up">
          <h3 className="font-display text-base tracking-wider">Scouting &mdash; Player Pool</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {undraftedPlayers.sort((a, b) => (b.overall || 0) - (a.overall || 0)).map((p, i) => (
              <div key={p.id} className="glass-card p-3 flex items-center gap-3 transition-all duration-200" style={{animationDelay: `${i * 0.02}s`}}>
                <div className="rating-circle rating-circle-sm" style={{'--pct': `${p.overall || 50}%`}}>
                  <span className="text-white text-xs">{p.overall || '-'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                  <div className="flex gap-2 text-xs text-[var(--text-tertiary)]">
                    <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.primaryPosition || p.position}</span>
                    <span>{p.age} yrs</span>
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--text-secondary)]">
                  <p>OFF {p.offense || '-'}</p>
                  <p>DEF {p.defense || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderJoining = () => {
    const hasJoined = draft?.joinedUsers?.includes(user?.id);
    return (
      <div className="space-y-4 stagger">
        <h2 className="font-display text-3xl tracking-wider animate-fade-up">Draft Starting</h2>

        <div className="glass-card p-5 text-center space-y-4 animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center mx-auto shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">The draft is about to begin!</p>
          <p className="text-xs text-[var(--text-tertiary])">Join now to make your picks live. If you don't join, the CPU will auto-pick for your team.</p>

          {countdown && (
            <div className="text-3xl font-display font-bold tracking-widest text-[var(--accent-orange)]">{countdown}</div>
          )}

          {!hasJoined ? (
            <button onClick={handleJoinDraft} className="btn-glow px-10 py-3 text-sm animate-pulse">
              Join Draft
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--accent-teal)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              You've joined the draft
            </div>
          )}

          <div className="bg-[var(--bg-secondary)] rounded-xl p-3 text-xs text-[var(--text-secondary)] text-left space-y-1">
            <p className="font-display text-xs tracking-wider text-center mb-2">Draft Board</p>
            {picks.filter(p => p.status === 'waiting').slice(0, 4).map(p => (
              <div key={p.order} className="flex items-center justify-between py-1 px-2 rounded bg-[var(--bg-primary)]/50">
                <span className="text-[var(--text-tertiary)]">Pick #{p.order}</span>
                <span>{p.teamName}</span>
              </div>
            ))}
            <p className="text-center text-[var(--text-tertiary)] pt-1">{computedTotalPicks} total picks &middot; {draft?.totalRounds || 2} rounds</p>
          </div>
        </div>
      </div>
    );
  };

  const renderLive = () => {
    const hasJoined = draft?.joinedUsers?.includes(user?.id);
    return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">Live Draft</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">Pick {draft?.currentPick}/{computedTotalPicks}</span>
        </div>
      </div>

      <div className="glass-card p-5 text-center animate-scale-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[var(--accent-orange)]/10 to-transparent rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-1 mb-3">
            <div className="min-w-[72px] px-3 py-1.5 rounded-xl border-2 font-display text-xl font-bold tracking-widest" style={{color: timeLeft <= 10 ? '#ef4444' : 'var(--accent-orange)', borderColor: timeLeft <= 10 ? '#ef4444' : 'var(--accent-orange)'}}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">remaining</span>
          </div>

          {currentPick ? (
            <>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Round {currentPick.round} &middot; Pick {currentPick.order} of {computedTotalPicks}</p>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-xl font-bold font-display text-white mx-auto mb-2 shadow-lg">
                {currentPick.teamName?.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="font-display text-xl tracking-wider">{currentPick.teamName}</h3>
              {currentPick.status === 'waiting' ? (
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {isMyTurn ? 'Your turn to pick!' : `On the clock`}
                </p>
              ) : currentPick.status === 'auto' ? (
                <p className="text-sm text-[var(--accent-gold)] mt-2 flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><polyline points="22 2 22 10 14 10"/></svg>
                  CPU Auto-Pick: {currentPick.playerName}
                </p>
              ) : (
                <p className="text-sm text-[var(--accent-teal)] mt-2 flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Selected: {currentPick.playerName}
                </p>
              )}
            </>
          ) : (
            <div className="py-4 space-y-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">Syncing draft data...</p>
              <p className="text-xs text-[var(--text-tertiary)]">Pick {draft?.currentPick} of {computedTotalPicks}</p>
            </div>
          )}
        </div>
      </div>

      {!hasJoined && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-accent)] rounded-xl p-3 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <p className="text-xs text-[var(--text-secondary)]">You haven't joined the draft. CPU will pick for you.</p>
          </div>
          <button onClick={handleJoinDraft} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-orange)] text-white font-medium hover:opacity-90 transition-opacity">Join Now</button>
        </div>
      )}

      <div className="space-y-2 animate-slide-up">
        <h3 className="font-display text-base tracking-wider">Available Players</h3>
        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {undraftedPlayers.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 15).map((p, i) => (
            <div key={p.id}
              className={`glass-card p-3 flex items-center gap-2 transition-all duration-200 ${
                isMyTurn && currentPick?.status === 'waiting' ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : ''
              }`}
              style={{animationDelay: `${i * 0.03}s`}}
            >
              <div className="rating-circle rating-circle-sm shrink-0" style={{'--pct': `${p.overall || 50}%`}} onClick={() => { if (isMyTurn && currentPick?.status === 'waiting') handlePick(p); }}>
                <span className="text-white text-xs">{p.overall || '-'}</span>
              </div>
              <div className="flex-1 min-w-0" onClick={() => { if (isMyTurn && currentPick?.status === 'waiting') handlePick(p); }}>
                <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                <div className="flex gap-2 text-xs text-[var(--text-tertiary)]">
                  <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{p.position || p.primaryPosition}</span>
                  <span>{p.age} yrs</span>
                  <span>{p.height}in</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-[var(--text-secondary)]">{p.offense || '-'} OFF</p>
                <p className="text-xs text-[var(--text-secondary)]">{p.defense || '-'} DEF</p>
              </div>
              <button onClick={() => setScoutPlayer(p)}
                className="shrink-0 text-[10px] px-2 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white hover:border-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 transition-all font-medium tracking-wider uppercase">
                Scout
              </button>
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
  };

  const renderCompleted = () => (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">Draft Complete</h2>
      <div className="glass-card p-5 text-center animate-scale-in">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><polyline points="20 6 9 17 4 12"/></svg>
        <p className="text-sm text-[var(--text-secondary)]">All {computedTotalPicks} picks have been completed!</p>
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
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-[10px] font-bold text-white">{p.teamName?.slice(0, 2).toUpperCase()}</div>
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

  return (
    <>
      {!draft && renderSetup()}
      {draft?.status === 'scheduled' && renderScheduled()}
      {draft?.status === 'joining' && renderJoining()}
      {draft?.status === 'live' && renderLive()}
      {draft?.status === 'completed' && renderCompleted()}
      <ScoutModal player={scoutPlayer} onDraft={handlePick} onClose={() => setScoutPlayer(null)} />
    </>
  );
}
