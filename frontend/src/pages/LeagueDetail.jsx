import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, leagueDoc, teamsCol, teamPlayersCol, seasonDoc, seasonGamesCol, leagueNewsCol, championshipsCol } from '../lib/firestore';
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

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;
  if (!league) return null;

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-xl p-5">
        <h2 className="text-xl font-bold">{league.name}</h2>
        <p className="text-gray-500 text-sm">{league.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="bg-[#1a1a2e] text-xs px-2 py-1 rounded">Season {league.currentSeason}</span>
          <span className="bg-[#1a1a2e] text-xs px-2 py-1 rounded">{teams.length} teams</span>
          <span className="bg-[#1a1a2e] text-xs px-2 py-1 rounded">Week {season?.currentWeek || 0}/{season?.totalWeeks || 24}</span>
          {season?.status === 'playoffs' && <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded">PLAYOFFS</span>}
          {season?.status === 'completed' && <span className="bg-green-500/20 text-green-500 text-xs px-2 py-1 rounded">SEASON OVER</span>}
        </div>
      </div>

      {!userTeam && (
        <div className="bg-[#16213e] rounded-xl p-5 text-center">
          <p className="text-gray-400 mb-3">You don't have a team in this league yet</p>
          <Link to={`/teams/create?league=${id}`} className="bg-[#e94560] text-white px-4 py-2 rounded-lg text-sm font-semibold inline-block">Create Team</Link>
        </div>
      )}

      {userTeam && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Your Team</h3>
            <Link to={`/teams/${userTeam.id}`} className="text-sm text-[#e94560]">Manage →</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: userTeam.primaryColor || '#1a1a2e' }}>
              {userTeam.abbreviation || userTeam.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{userTeam.name}</p>
              <p className="text-xs text-gray-500">{userTeam.wins || 0}W - {userTeam.losses || 0}L</p>
            </div>
          </div>
        </div>
      )}

      {season?.status !== 'completed' && userTeam && (
        <div className="flex gap-2">
          <button onClick={simWeek} disabled={simming} className="flex-1 bg-[#e94560] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#d63851] transition disabled:opacity-50">
            {simming ? 'Simming...' : season?.status === 'pregame' ? 'Start Season' : 'Sim Next Week'}
          </button>
          <button onClick={simAll} disabled={simming} className="flex-1 bg-gray-700 text-white rounded-lg py-2.5 text-sm hover:bg-gray-600 transition disabled:opacity-50">Sim All</button>
        </div>
      )}

      <div className="bg-[#16213e] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Standings</h3>
          <Link to={`/leagues/${id}/standings`} className="text-sm text-[#e94560]">Full →</Link>
        </div>
        <div className="space-y-1">
          {teams.sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 5).map((team, i) => (
            <Link key={team.id} to={`/teams/${team.id}`} className="flex items-center gap-2 py-1.5 text-sm hover:bg-[#1a1a2e] px-2 rounded">
              <span className="w-5 text-center text-gray-500">{i + 1}</span>
              <span className="font-medium flex-1">{team.name}</span>
              <span className="text-gray-400">{team.wins || 0}W - {team.losses || 0}L</span>
            </Link>
          ))}
        </div>
      </div>

      {news.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">League News</h3>
            <Link to={`/leagues/${id}/news`} className="text-sm text-[#e94560]">All →</Link>
          </div>
          <div className="space-y-2">
            {news.slice(0, 3).map((item, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-gray-500">{item.body?.slice(0, 60)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {championships.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-2">🏆 Champions</h3>
          <div className="space-y-1 text-sm">
            {championships.map(c => (
              <p key={c.id} className="text-gray-400">Season {c.seasonNumber}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {season && <Link to={`/leagues/${id}/season/${season.id}`} className="flex-1 bg-gray-700 text-center rounded-lg py-2 text-sm hover:bg-gray-600 transition">Schedule</Link>}
        <button onClick={getPredictions} className="flex-1 bg-gray-700 rounded-lg py-2 text-sm hover:bg-gray-600 transition">AI Predictions</button>
      </div>

      {predictions && (
        <div className="bg-[#16213e] rounded-xl p-4">
          <h3 className="font-semibold mb-3">🔮 Season Predictions</h3>
          <div className="space-y-1 text-sm">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span>{i + 1}. {p.teamName}</span>
                <span className="text-gray-500">{p.projectedWins}W · {p.playoffOdds}% playoffs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
