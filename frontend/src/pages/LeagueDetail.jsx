import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leagueDoc, teamsCol, teamPlayersCol, seasonDoc, seasonGamesCol, leagueNewsCol, championshipsCol, championshipDoc, leagueNewsDoc } from '../lib/firestore';
import { generateSchedule, simulateGame, calculateTeamRating } from '../engine/gameEngine';
import { generateSeasonPrediction, generateStory } from '../engine/aiEngine';

export default function LeagueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [season, setSeason] = useState(null);
  const [championships, setChampionships] = useState([]);
  const [news, setNews] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [nextGame, setNextGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simming, setSimming] = useState(false);
  const [headlineIdx, setHeadlineIdx] = useState(0);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 8000);
    load();
    return () => clearTimeout(fallback);
  }, [id]);

  useEffect(() => {
    if (news.length <= 1) return;
    const timer = setInterval(() => {
      setHeadlineIdx(prev => (prev + 1) % news.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [news.length]);

  const load = async () => {
    setLoading(true);
    try {
      const leagueSnap = await getDoc(leagueDoc(id));
      if (!leagueSnap.exists()) { setLoading(false); navigate('/leagues'); return; }
      const lData = { id: leagueSnap.id, ...leagueSnap.data() };
      setLeague(lData);

      const teamSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id)));
      const tData = [];
      for (const tDoc of teamSnap.docs) {
        const t = { id: tDoc.id, ...tDoc.data() };
        const pSnap = await getDocs(query(teamPlayersCol(tDoc.id), where('seasonId', '==', lData.currentSeason || 1)));
        t.players = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        tData.push(t);
      }
      setTeams(tData);

      try {
        const seasonSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', id), orderBy('seasonNumber', 'desc'), limit(1)));
        if (!seasonSnap.empty) {
          const seasonData = { id: seasonSnap.docs[0].id, ...seasonSnap.docs[0].data() };
          setSeason(seasonData);

          try {
            const gamesSnap = await getDocs(query(seasonGamesCol(seasonData.id), orderBy('playedAt', 'desc'), limit(5)));
            setRecentGames(gamesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) { console.error('games query:', e); }

          try {
            const userTeamSnap = await getDocs(query(teamsCol(), where('leagueId', '==', id), where('userId', '==', user?.id)));
            if (!userTeamSnap.empty) {
              const utId = userTeamSnap.docs[0].id;
              const allGamesSnap = await getDocs(seasonGamesCol(seasonData.id));
              const teamGames = allGamesSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(g => g.isCompleted !== 1 && (g.homeTeamId === utId || g.awayTeamId === utId))
                .sort((a, b) => (a.week || 0) - (b.week || 0));
              if (teamGames.length > 0) setNextGame(teamGames[0]);
            }
          } catch (e) { console.error('nextGame query:', e); }
        }
      } catch (e) { console.error('season query:', e); }

      try {
        const champSnap = await getDocs(query(championshipsCol(id), orderBy('seasonNumber', 'desc'), limit(5)));
        setChampionships(champSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('champs query:', e); }

      try {
        const newsSnap = await getDocs(query(leagueNewsCol(id), orderBy('createdAt', 'desc'), limit(10)));
        setNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('news query:', e); }
    } catch (err) {
      console.error('LeagueDetail load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const simWeek = async () => {
    if (!season) return;
    setSimming(true);
    try {
      let currentSeason = season;
      if (season.status === 'pregame') {
        await updateDoc(seasonDoc(season.id), { status: 'regular' });
        currentSeason = { ...season, status: 'regular' };
      }
      const week = currentSeason.currentWeek + 1;
      const isPlayoffs = week > currentSeason.totalWeeks - 4;
      const teamIds = teams.map(t => t.id);
      const pairs = generateSchedule(teamIds);
      const games = [];

      for (const pair of pairs) {
        const gameId = uid();
        const homeTeam = teams.find(t => t.id === pair.home);
        const awayTeam = teams.find(t => t.id === pair.away);
        if (!homeTeam || !awayTeam) continue;

        const homePlayers = (homeTeam.players || []).map(p => ({ ...p, teamId: homeTeam.id }));
        const awayPlayers = (awayTeam.players || []).map(p => ({ ...p, teamId: awayTeam.id }));

        const result = simulateGame(homePlayers, awayPlayers);
        const gameData = {
          seasonId: season.id, week, homeTeamId: pair.home, awayTeamId: pair.away,
          homeScore: result.homeScore, awayScore: result.awayScore,
          isPlayoff: isPlayoffs ? 1 : 0, isCompleted: 1,
          playedAt: new Date().toISOString(),
        };
        await setDoc(doc(seasonGamesCol(season.id), gameId), gameData);

        const allStats = [...result.homeStats, ...result.awayStats];
        for (const stat of allStats) {
          await setDoc(doc(collection(db, 'seasons', season.id, 'games', gameId, 'stats'), stat.playerId), stat);
        }

        games.push({ ...gameData, id: gameId });
      }

      await updateDoc(seasonDoc(season.id), { currentWeek: week });
      const isSeasonOver = week >= currentSeason.totalWeeks;
      if (isSeasonOver) {
        await updateDoc(seasonDoc(season.id), { status: 'completed', completedAt: new Date().toISOString() });
        const champId = uid();
        await setDoc(championshipDoc(id, champId), {
          seasonNumber: currentSeason.seasonNumber, teamId: games[0]?.homeTeamId || '',
          createdAt: new Date().toISOString(),
        });
        const newSeasonId = uid();
        await setDoc(doc(db, 'seasons', newSeasonId), {
          leagueId: id, seasonNumber: (currentSeason.seasonNumber || 1) + 1,
          status: 'pregame', currentWeek: 0, totalWeeks: 24,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(leagueDoc(id), { currentSeason: (currentSeason.seasonNumber || 1) + 1 });
      }

      if (Math.random() > 0.6) {
        const story = generateStory(teams, ['general', 'trade', 'rivalry', 'mvp'][Math.floor(Math.random() * 4)]);
        await setDoc(leagueNewsDoc(id, uid()), {
          ...story, leagueId: id, createdAt: new Date().toISOString(),
        });
      }

      load();
    } finally {
      setSimming(false);
    }
  };

  const simAll = async () => {
    if (!season) return;
    setSimming(true);
    try {
      const totalWeeks = season.totalWeeks;
      for (let w = 1; w <= totalWeeks; w++) {
        await simWeek();
      }
    } finally {
      setSimming(false);
    }
  };

  const handleStartOffseason = async () => {
    if (!league) return;
    try {
      await updateDoc(leagueDoc(id), { offseason: true });
      setLeague(prev => ({ ...prev, offseason: true }));
    } catch (e) {
      console.error('Start offseason error:', e);
    }
  };

  const handleEndOffseason = async () => {
    if (!league) return;
    try {
      const newSeasonId = uid();
      const nextNumber = (league.currentSeason || 1) + 1;
      await setDoc(doc(db, 'seasons', newSeasonId), {
        leagueId: id, seasonNumber: nextNumber,
        status: 'pregame', currentWeek: 0, totalWeeks: 24,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(leagueDoc(id), { currentSeason: nextNumber, offseason: false });
      setLeague(prev => ({ ...prev, currentSeason: nextNumber, offseason: false }));
      load();
    } catch (e) {
      console.error('End offseason error:', e);
    }
  };

  const getPredictions = () => {
    const preds = generateSeasonPrediction(teams);
    setPredictions(preds);
  };

  const userTeam = teams.find(t => t.userId === user?.id);
  const isCommissioner = league?.commissionerId === user?.id;
  const sortedTeams = [...teams].sort((a, b) => (b.wins || 0) - (a.wins || 0));
  const userRank = userTeam ? sortedTeams.findIndex(t => t.id === userTeam.id) + 1 : null;
  const userOvr = userTeam?.players?.length ? calculateTeamRating(userTeam.players) : null;

  const getTeamById = (teamId) => teams.find(t => t.id === teamId);

  const headlines = news.length > 0 ? news : [];

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );
  if (!league) return null;

  return (
    <div className="space-y-3 stagger">

      {/* ── Team Header ── */}
      <div className="glass-card p-4 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-card)] to-[var(--accent-orange)]/5 relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[var(--accent-orange)]/8 to-transparent rounded-full blur-3xl" />
        <div className="flex flex-wrap items-start gap-2 sm:gap-3 relative z-10">
          {userTeam ? (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-base sm:text-xl font-bold font-display text-white shadow-lg relative shrink-0"
                style={{ background: `linear-gradient(135deg, ${userTeam.primaryColor || '#ff7b35'}, ${userTeam.secondaryColor || '#e83a4b'})` }}>
                {userTeam.abbreviation || userTeam.name?.slice(0, 2).toUpperCase()}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-orange)]"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-2xl tracking-wider text-white leading-tight">{userTeam.name}</h2>
                  <span className="text-lg text-[var(--text-tertiary)]">·</span>
                  <p className="font-display text-lg tracking-wider text-[var(--text-secondary)]">{league.name}</p>
                  {isCommissioner && (
                    <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 text-[10px] px-1.5 py-0.5">Commissioner</span>
                  )}
                </div>
                <div className="flex gap-3 sm:gap-4 mt-2">
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">OVR</p>
                    <p className="font-display text-base sm:text-lg text-white">{userOvr || '--'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">RANK</p>
                    <p className="font-display text-base sm:text-lg text-white">{userRank ? `#${userRank}` : '--'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">REC</p>
                    <p className="font-display text-base sm:text-lg text-white">{userTeam.wins || 0}-{userTeam.losses || 0}</p>
                  </div>
                </div>
                <div className="mt-2 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (userOvr || 50))}%` }} />
                </div>
              </div>

              <div className="w-full sm:w-32 shrink-0">
                <p className="text-[10px] text-[var(--accent-orange)] font-semibold tracking-wider uppercase mb-1 sm:mb-1.5">Next Game</p>
                {(() => {
                  if (nextGame) {
                    const oppId = nextGame.homeTeamId === userTeam?.id ? nextGame.awayTeamId : nextGame.homeTeamId;
                    const opp = teams.find(t => t.id === oppId);
                    const isHome = nextGame.homeTeamId === userTeam?.id;
                    return (
                      <div className="bg-[var(--bg-secondary)] rounded-xl p-2 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: userTeam.primaryColor || '#ff7b35' }}>
                            {userTeam.abbreviation || userTeam.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[10px] text-[var(--text-tertiary)] font-bold">VS</span>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: opp?.primaryColor || '#ff7b35' }}>
                            {opp?.abbreviation || opp?.name?.slice(0, 2).toUpperCase() || '??'}
                          </div>
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] font-medium truncate">{opp?.name || 'TBD'}</p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">{isHome ? 'vs' : '@'} {opp?.name || 'TBD'}</p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">Week {nextGame.week || '?'}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-2 text-center space-y-1 flex flex-col items-center justify-center min-h-[90px]">
                      <p className="text-[10px] text-[var(--text-tertiary)]">No game</p>
                      <p className="font-display text-base tracking-wider text-[var(--text-secondary)]">TBD</p>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="flex-1 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-lg font-bold font-display text-white shadow-lg mx-auto mb-2">
                {league.name?.slice(0, 2).toUpperCase()}
              </div>
              <p className="font-display text-xl tracking-wider">{league.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">{teams.length} teams</p>
            </div>
          )}
        </div>

        {userTeam && recentGames.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-tertiary)] mb-2">Recent Game</p>
            {(() => {
              const lastGame = recentGames[0];
              const home = getTeamById(lastGame.homeTeamId);
              const away = getTeamById(lastGame.awayTeamId);
              if (!home || !away) return null;
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: home.primaryColor || '#ff7b35' }}>
                      {home.abbreviation || home.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{home.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg">{lastGame.homeScore}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">-</span>
                    <span className="font-display text-lg">{lastGame.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{away.name}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: away.primaryColor || '#ff7b35' }}>
                      {away.abbreviation || away.name?.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Headlines Carousel ── */}
      {headlines.length > 0 && (
        <div className="glass-card overflow-hidden animate-slide-up relative">
          <div className="absolute top-3 left-4 z-10">
            <p className="text-[10px] font-bold tracking-widest text-[var(--accent-orange)] uppercase">League Headlines</p>
          </div>
          {(() => {
            const h = headlines[headlineIdx];
            return (
              <div className="pt-8 pb-3 px-4 bg-gradient-to-br from-[var(--accent-orange)]/10 to-transparent min-h-[100px]">
                <h3 className="font-display text-lg tracking-wider text-white leading-snug">{h.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{h.body?.slice(0, 100)}...</p>
              </div>
            );
          })()}
          <div className="flex justify-center gap-1.5 pb-3">
            {headlines.slice(0, 5).map((_, i) => (
              <button key={i} onClick={() => setHeadlineIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === headlineIdx ? 'bg-[var(--accent-orange)] w-4' : 'bg-[var(--text-tertiary)]/30'}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions Grid ── */}
      <div className="grid grid-cols-6 gap-2 animate-fade-up">
        {[
          { label: 'My Team', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, to: userTeam ? `/teams/${userTeam.id}` : `/teams/create?league=${id}` },
          { label: 'Free Agents', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>, to: `/leagues/${id}/freeagents` },
          { label: 'Standings', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>, to: `/leagues/${id}/standings` },
          { label: 'Schedule', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, to: season ? `/leagues/${id}/season/${season.id}` : '#' },
          { label: 'Draft', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, to: `/leagues/${id}/draft` },
          { label: 'Trades', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>, to: `/trades/${id}` },
        ].map((action) => (
          <Link key={action.label} to={action.to}
            className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-[var(--bg-tertiary)] transition-all duration-200 group">
            <span className="text-[var(--accent-orange)] drop-shadow-[0_0_4px_rgba(255,107,53,0.25)] transition-all duration-200">{action.icon}</span>
            <span className="text-[10px] text-center leading-tight text-[var(--text-secondary)] font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Sim Controls ── */}
      {season?.status !== 'completed' && userTeam && (
        <div className="flex gap-2 animate-fade-up">
          <button onClick={simWeek} disabled={simming}
            className={`flex-1 btn-glow py-2.5 text-sm ${simming ? 'animate-pulse-glow' : ''}`}>
            {simming ? 'Simming...' : season?.status === 'pregame' ? 'Start Season' : 'Sim Next Week'}
          </button>
          <button onClick={simAll} disabled={simming} className="flex-1 btn-ghost py-2.5 text-sm">Sim All</button>
        </div>
      )}

      {/* ── Offseason Controls ── */}
      {isCommissioner && season?.status === 'completed' && !league?.offseason && (
        <button onClick={handleStartOffseason} className="btn-glow w-full py-2.5 text-sm">
          Start Offseason
        </button>
      )}
      {isCommissioner && league?.offseason === true && (
        <button onClick={handleEndOffseason} className="btn-glow w-full py-2.5 text-sm">
          End Offseason
        </button>
      )}

      {/* ── Recent Games ── */}
      {recentGames.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base tracking-wider">Recent Games</h3>
            {season && <Link to={`/leagues/${id}/season/${season.id}`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">View All</Link>}
          </div>
          <div className="space-y-2">
            {recentGames.slice(0, 3).map((game) => {
              const home = getTeamById(game.homeTeamId);
              const away = getTeamById(game.awayTeamId);
              if (!home || !away) return null;
              const homeWin = game.homeScore > game.awayScore;
              return (
                <div key={game.id} className="flex items-center justify-between py-2 px-2 rounded-lg bg-[var(--bg-secondary)]/50">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: home.primaryColor || '#ff7b35' }}>
                      {home.abbreviation || home.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-xs font-medium truncate ${homeWin ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>{home.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2">
                    <span className={`font-display text-sm ${homeWin ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>{game.homeScore}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">-</span>
                    <span className={`font-display text-sm ${!homeWin ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>{game.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className={`text-xs font-medium truncate ${!homeWin ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>{away.name}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: away.primaryColor || '#ff7b35' }}>
                      {away.abbreviation || away.name?.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Two Column: Standings Preview + League Info ── */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up">
        <div className="glass-card p-4">
          <h3 className="font-display text-sm tracking-wider mb-3">Standings</h3>
          <div className="space-y-1">
            {sortedTeams.slice(0, 5).map((team, i) => (
              <Link key={team.id} to={`/teams/${team.id}`}
                className="flex items-center gap-2 py-1.5 text-xs hover:bg-[var(--bg-secondary)] px-1.5 rounded-lg transition-colors">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] text-white' : 'text-[var(--text-tertiary)]'}`}>{i + 1}</span>
                <span className="font-medium flex-1 truncate">{team.name}</span>
                <span className="text-[var(--text-tertiary)] text-[10px]">{team.wins || 0}-{team.losses || 0}</span>
              </Link>
            ))}
            {sortedTeams.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] text-center py-2">No teams yet</p>
            )}
          </div>
        </div>

        <div className="glass-card p-4 flex flex-col">
          <h3 className="font-display text-sm tracking-wider mb-3">League Info</h3>
          <div className="space-y-2 flex-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Season</span>
              <span className="font-medium">{league.currentSeason || 1}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Teams</span>
              <span className="font-medium">{teams.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Week</span>
              <span className="font-medium">{season?.currentWeek || 0}/{season?.totalWeeks || 24}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Status</span>
              <span className={`font-medium ${season?.status === 'completed' ? 'text-green-400' : season?.status === 'playoffs' ? 'text-yellow-400' : 'text-[var(--text-secondary)]'}`}>
                {season?.status === 'pregame' ? 'Preseason' : season?.status === 'regular' ? 'Regular Season' : season?.status === 'playoffs' ? 'Playoffs' : season?.status === 'completed' ? 'Completed' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Champions</span>
              <span className="font-medium">{championships.length}</span>
            </div>
          </div>
          {!userTeam && (
            <Link to={`/teams/create?league=${id}`}
              className="btn-glow mt-3 w-full py-2 text-xs text-center block">
              Create Team
            </Link>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      {news.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base tracking-wider">Recent Activity</h3>
            <Link to={`/leagues/${id}/news`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">View All</Link>
          </div>
          <div className="space-y-2">
            {news.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff7b35]/20 to-[#e83a4b]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{item.body?.slice(0, 50)}...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Champions ── */}
      {championships.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <h3 className="font-display text-base tracking-wider mb-3">
            <span className="text-[var(--accent-yellow)]">&#127942;</span> Champions
          </h3>
          <div className="space-y-1 text-sm">
            {championships.map(c => {
              const champTeam = getTeamById(c.teamId);
              return (
                <div key={c.id} className="flex items-center justify-between py-1.5">
                  <span className="text-[var(--text-secondary)]">Season {c.seasonNumber}</span>
                  <span className="font-medium text-xs">{champTeam?.name || 'TBD'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Predictions ── */}
      {predictions && (
        <div className="glass-card p-4 animate-scale-in">
          <h3 className="font-display text-base tracking-wider mb-3">
            <span className="badge badge-ai mr-2">AI</span> Season Predictions
          </h3>
          <div className="space-y-1.5 text-sm">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'text-[var(--accent-orange)]' : 'text-[var(--text-tertiary)]'}`}>{i + 1}</span>
                  <span>{p.teamName}</span>
                </div>
                <span className="text-[var(--text-secondary)] text-xs">{p.projectedWins}W &middot; {p.playoffOdds}% PO</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Predictions Button ── */}
      {!predictions && (
        <div className="flex gap-2 animate-fade-up">
          <button onClick={getPredictions} className="flex-1 btn-ghost py-2.5 text-sm">AI Predictions</button>
        </div>
      )}
    </div>
  );
}
