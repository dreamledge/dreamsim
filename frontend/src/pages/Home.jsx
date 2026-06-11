import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { query, where, orderBy, getDocs, collection, doc, getDoc, deleteDoc, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { leaguesCol, leagueDoc, leagueNewsCol, teamsCol, teamPlayersCol } from '../lib/firestore';

export default function Home() {
  const { user } = useAuth();
  const [userLeagues, setUserLeagues] = useState([]);
  const [newsMap, setNewsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [leavingIds, setLeavingIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fallback = setTimeout(() => setLoading(false), 8000);
    const load = async () => {
      try {
        const teamsSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
        const leagueIds = new Set(teamsSnap.docs.map(d => d.data().leagueId));

        const commishSnap = await getDocs(query(collection(db, 'leagues'), where('commissionerId', '==', user.id)));
        commishSnap.docs.forEach(d => leagueIds.add(d.id));

        const leagues = [];
        for (const lid of leagueIds) {
          const snap = await getDoc(leagueDoc(lid));
          if (snap.exists()) leagues.push({ id: snap.id, ...snap.data() });
        }
        setUserLeagues(leagues);

        const nm = {};
        for (const l of leagues.slice(0, 3)) {
          try {
            const newsSnap = await getDocs(query(leagueNewsCol(l.id), orderBy('createdAt', 'desc'), limit(3)));
            nm[l.id] = newsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch {}
        }
        setNewsMap(nm);
      } catch (err) {
        console.error('Home load error:', err);
      } finally {
        clearTimeout(fallback);
        setLoading(false);
      }
    };
    load();
    return () => clearTimeout(fallback);
  }, [user]);

  const handleLeaveLeague = useCallback(async (e, league) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to leave "${league.name}"?`)) return;
    setLeavingIds(prev => new Set(prev).add(league.id));
    try {
      const teamsSnap = await getDocs(query(
        teamsCol(),
        where('userId', '==', user.id),
        where('leagueId', '==', league.id)
      ));
      for (const teamDocSnap of teamsSnap.docs) {
        const playersSnap = await getDocs(teamPlayersCol(teamDocSnap.id));
        for (const p of playersSnap.docs) {
          await deleteDoc(p.ref);
        }
        await deleteDoc(teamDocSnap.ref);
      }
      setUserLeagues(prev => prev.filter(l => l.id !== league.id));
    } catch (err) {
      console.error('Failed to leave league:', err);
    } finally {
      setLeavingIds(prev => { const nxt = new Set(prev); nxt.delete(league.id); return nxt; });
    }
  }, [user]);

  const isCommissioner = (league) => league.commissionerId === user.id;

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display text-xl tracking-wider">Welcome{user?.displayName ? `, ${user.displayName}` : ''}</h2>
          <p className="text-[var(--text-secondary)] text-sm">{userLeagues.length} active league{userLeagues.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/leagues/create')} className="btn-glow px-4 py-2 text-sm">+ New League</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="relative loader-2k" />
        </div>
      ) : userLeagues.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-2xl mb-4 shadow-lg shadow-[#ff7b35]/20">🏀</div>
          <h3 className="font-display text-2xl tracking-wider">Welcome to Dynasty</h3>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Create or join a league to get started</p>
          <div className="flex gap-3 mt-6 justify-center">
            <Link to="/leagues/create" className="btn-glow px-5 py-2.5 text-sm">Create League</Link>
            <Link to="/leagues" className="btn-ghost px-5 py-2.5 text-sm">Join League</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.12em] font-semibold text-[var(--text-tertiary)]">Your Leagues</h3>
            <div className="space-y-2">
              {userLeagues.map((league, i) => (
                <Link key={league.id} to={`/leagues/${league.id}`} className="glass-card p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:translate-x-0.5 group" style={{animationDelay: `${i * 0.06}s`}}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm">L</div>
                    <div>
                      <h4 className="font-semibold text-sm">{league.name}</h4>
                      <p className="text-xs text-[var(--text-tertiary)]">Season {league.currentSeason || 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCommissioner(league) && (
                      <button
                        onClick={(e) => handleLeaveLeague(e, league)}
                        disabled={leavingIds.has(league.id)}
                        className="px-2.5 py-1 text-xs rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all disabled:opacity-50"
                      >
                        {leavingIds.has(league.id) ? 'Leaving...' : 'Leave'}
                      </button>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-orange)] opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {Object.entries(newsMap).filter(([,v]) => v.length > 0).map(([leagueId, news], li) => (
            <div key={leagueId} className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.12em] font-semibold text-[var(--text-tertiary)]">Latest News</h3>
              {news.map((item, i) => (
                <div key={i} className="glass-card p-3.5 accent-stripe" style={{animationDelay: `${i * 0.06 + 0.1}s`}}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{item.storyType === 'championship' ? '🏆' : item.storyType === 'trade' ? '🤝' : '📰'}</span>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.body?.slice(0, 80)}...</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
