import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leagueDoc, teamsCol, teamPlayersCol, seasonDoc, seasonGamesCol, leagueNewsCol, championshipsCol, championshipDoc, leagueNewsDoc } from '../lib/firestore';
import { generateSchedule, simulateGame } from '../engine/gameEngine';
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
  const [loading, setLoading] = useState(true);
  const [simming, setSimming] = useState(false);

  const load = async () => {
    setLoading(true);
    const leagueSnap = await getDoc(leagueDoc(id));
    if (!leagueSnap.exists()) { navigate('/leagues'); return; }
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

    const seasonSnap = await getDocs(query(collection(db, 'seasons'), where('leagueId', '==', id), orderBy('seasonNumber', 'desc'), limit(1)));
    if (!seasonSnap.empty) {
      setSeason({ id: seasonSnap.docs[0].id, ...seasonSnap.docs[0].data() });
    }

    const champSnap = await getDocs(query(championshipsCol(id), orderBy('seasonNumber', 'desc'), limit(5)));
    setChampionships(champSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const newsSnap = await getDocs(query(leagueNewsCol(id), orderBy('createdAt', 'desc'), limit(10)));
    setNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

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

  const getPredictions = () => {
    const preds = generateSeasonPrediction(teams);
    setPredictions(preds);
  };

  const userTeam = teams.find(t => t.userId === user?.id);
  const isCommissioner = league?.commissionerId === user?.id;

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );
  if (!league) return null;

  return (
    <div className="space-y-4 stagger">
      <div className="glass-card p-5 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-card)] to-[#ff6b35]/5 relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff6b35]/10 to-transparent rounded-full blur-2xl" />
        <h2 className="font-display text-3xl tracking-wider">{league.name}</h2>
        <p className="text-[var(--text-secondary)] text-sm">{league.description}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs px-3 py-1 rounded-full font-medium">Season {league.currentSeason}</div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs px-3 py-1 rounded-full font-medium">{teams.length} teams</div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs px-3 py-1 rounded-full font-medium">Week {season?.currentWeek || 0}/{season?.totalWeeks || 24}</div>
          {season?.status === 'playoffs' && <div className="badge bg-yellow-500/20 text-yellow-500 border border-yellow-500/20">Playoffs</div>}
          {season?.status === 'completed' && <div className="badge bg-green-500/20 text-[var(--accent-green)] border border-green-500/20">Season Over</div>}
        </div>
      </div>

      {!userTeam ? (
        <div className="glass-card p-6 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)] mb-4">You don't have a team in this league yet</p>
          <Link to={`/teams/create?league=${id}`} className="btn-glow inline-block px-5 py-2.5 text-sm">Create Team</Link>
        </div>
      ) : (
        <div className="glass-card p-4 hover:bg-[var(--bg-tertiary)] transition-all duration-200">
          <Link to={`/teams/${userTeam.id}`} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold font-display text-white shadow-md" style={{ backgroundColor: userTeam.primaryColor || '#ff6b35' }}>
                {userTeam.abbreviation || userTeam.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{userTeam.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{userTeam.wins || 0}W - {userTeam.losses || 0}L</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--accent-orange)] font-medium">Manage</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-orange)]"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>
        </div>
      )}

      {season?.status !== 'completed' && userTeam && (
        <div className="flex gap-2 animate-fade-up">
          <button onClick={simWeek} disabled={simming} className={`flex-1 btn-glow py-2.5 text-sm ${simming ? 'animate-pulse-glow' : ''}`}>
            {simming ? 'Simming...' : season?.status === 'pregame' ? 'Start Season' : 'Sim Next Week'}
          </button>
          <button onClick={simAll} disabled={simming} className="flex-1 btn-ghost py-2.5 text-sm">Sim All</button>
        </div>
      )}

      <div className="glass-card p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg tracking-wider">Standings</h3>
          <Link to={`/leagues/${id}/standings`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">Full →</Link>
        </div>
        <div className="space-y-0.5">
          {teams.sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 5).map((team, i) => (
            <Link key={team.id} to={`/teams/${team.id}`} className="flex items-center gap-2 py-2 text-sm hover:bg-[var(--bg-secondary)] px-2 rounded-lg transition-colors group">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] text-white' : 'text-[var(--text-tertiary)]'}`}>{i + 1}</span>
              <span className="font-medium flex-1">{team.name}</span>
              <span className="text-[var(--text-secondary)] text-xs">{team.wins || 0}W - {team.losses || 0}L</span>
            </Link>
          ))}
        </div>
      </div>

      {news.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg tracking-wider">League News</h3>
            <Link to={`/leagues/${id}/news`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">All →</Link>
          </div>
          <div className="space-y-2">
            {news.slice(0, 3).map((item, i) => (
              <div key={i} className="text-sm py-1 border-l-2 border-[var(--accent-orange)] pl-3">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{item.body?.slice(0, 60)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {championships.length > 0 && (
        <div className="glass-card p-4 animate-slide-up">
          <h3 className="font-display text-lg tracking-wider mb-3">
            <span className="text-[var(--accent-yellow)]">🏆</span> Champions
          </h3>
          <div className="space-y-1 text-sm">
            {championships.map(c => (
              <p key={c.id} className="text-[var(--text-secondary)]">Season {c.seasonNumber}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 animate-fade-up">
        {season && <Link to={`/leagues/${id}/season/${season.id}`} className="flex-1 btn-ghost text-center py-2.5 text-sm">Schedule</Link>}
        <button onClick={getPredictions} className="flex-1 btn-ghost py-2.5 text-sm">AI Predictions</button>
      </div>

      {predictions && (
        <div className="glass-card p-4 animate-scale-in">
          <h3 className="font-display text-lg tracking-wider mb-3">
            <span className="badge badge-ai mr-2">AI</span> Season Predictions
          </h3>
          <div className="space-y-1.5 text-sm">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'text-[var(--accent-orange)]' : 'text-[var(--text-tertiary)]'}`}>{i + 1}</span>
                  <span>{p.teamName}</span>
                </div>
                <span className="text-[var(--text-secondary)] text-xs">{p.projectedWins}W · {p.playoffOdds}% PO</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
